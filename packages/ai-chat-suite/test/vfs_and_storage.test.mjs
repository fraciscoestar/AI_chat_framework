import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVirtualPath,
  SandboxSecurityError,
  VirtualFileSystem,
  MemoryStorageAdapter,
  SkillManager,
  ToolManager,
  getActiveBranch,
  getMessageSiblings,
  findDeepestLeafId,
  formatExecutionSummary,
} from '../dist/index.mjs';

test('VFS Path Normalization & Sandbox Traversal Protection', async (t) => {
  await t.test('normalizes standard relative and absolute paths', () => {
    assert.equal(normalizeVirtualPath('notes/todo.md'), '/notes/todo.md');
    assert.equal(normalizeVirtualPath('/docs/api.md'), '/docs/api.md');
    assert.equal(normalizeVirtualPath('folder/sub/../file.txt'), '/folder/file.txt');
  });

  await t.test('strips Windows drive letters', () => {
    assert.equal(normalizeVirtualPath('C:\\Users\\admin\\secret.txt'), '/Users/admin/secret.txt');
    assert.equal(normalizeVirtualPath('D:/workspace/file.js'), '/workspace/file.js');
  });

  await t.test('prevents ascending above root with .. traversal', () => {
    assert.throws(
      () => normalizeVirtualPath('../../../etc/passwd'),
      SandboxSecurityError,
      'Path traversal attempt detected'
    );

    assert.throws(
      () => normalizeVirtualPath('/notes/../../outside.txt'),
      SandboxSecurityError,
      'Path traversal attempt detected'
    );
  });

  await t.test('rejects null bytes', () => {
    assert.throws(
      () => normalizeVirtualPath('/notes/\0secret.txt'),
      SandboxSecurityError,
      'Null bytes are prohibited'
    );
  });
});

test('VFS File Operations with Memory Storage', async () => {
  const storage = new MemoryStorageAdapter();
  const vfs = new VirtualFileSystem('user-abc', storage);

  // Write file
  const file = await vfs.writeFile('/notes/test.txt', 'Hello sandbox');
  assert.equal(file.path, '/notes/test.txt');
  assert.equal(file.name, 'test.txt');
  assert.equal(file.content, 'Hello sandbox');

  // Read file
  const content = await vfs.readFile('/notes/test.txt');
  assert.equal(content, 'Hello sandbox');

  // Exists
  const exists = await vfs.exists('/notes/test.txt');
  assert.equal(exists, true);

  // List files
  const files = await vfs.listFiles();
  assert.equal(files.length, 1);
  assert.equal(files[0].path, '/notes/test.txt');

  // Delete file
  await vfs.deleteFile('/notes/test.txt');
  const filesAfter = await vfs.listFiles();
  assert.equal(filesAfter.length, 0);
});

test('MemoryStorageAdapter Ephemeral vs Persistent Conversations', async () => {
  const storage = new MemoryStorageAdapter();

  const persistentConv = {
    id: 'conv-1',
    title: 'Persistent Chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    artifacts: [],
    isEphemeral: false,
  };

  await storage.saveConversation('user-1', persistentConv);
  const loaded = await storage.getConversations('user-1');
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'conv-1');

  // Folders
  const folder = {
    id: 'folder-1',
    name: 'Work Projects',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await storage.saveFolder('user-1', folder);
  const folders = await storage.getFolders('user-1');
  assert.equal(folders.length, 1);
  assert.equal(folders[0].name, 'Work Projects');

  // Delete folder unlinks conversation folderId
  persistentConv.folderId = 'folder-1';
  await storage.saveConversation('user-1', persistentConv);
  await storage.deleteFolder('user-1', 'folder-1');

  const convAfterFolderDelete = await storage.getConversation('user-1', 'conv-1');
  assert.equal(convAfterFolderDelete?.folderId, null);
});

test('SkillManager Two-Tier Discovery & Read Skill Tool', () => {
  const skills = [
    {
      id: 'markdown-guide',
      name: 'Markdown Guide',
      description: 'Rules for clean markdown',
      content: '# Full markdown guidelines content...',
    },
  ];

  const manager = new SkillManager(skills);

  // 1. Prompt catalog only contains summary (token efficient)
  const catalogPrompt = manager.formatCatalogForPrompt();
  assert.ok(catalogPrompt.includes('Markdown Guide'));
  assert.ok(catalogPrompt.includes('Rules for clean markdown'));
  assert.ok(!catalogPrompt.includes('Full markdown guidelines content'));

  // 2. On-demand tool execution returns full content
  const toolDef = manager.getReadSkillToolDefinition();
  assert.equal(toolDef.name, 'read_skill');

  const readResult = manager.executeReadSkill({
    id: 'call-1',
    name: 'read_skill',
    args: { skillId: 'markdown-guide' },
  });

  assert.equal(readResult.isError, false);
  assert.ok(readResult.output?.includes('Full markdown guidelines content'));
});

test('Tree-Based Conversation Branching & Sibling Cycling (OpenWebUI style)', async (t) => {
  // Tree structure:
  // Root: u1
  //   ├─> a1 (branch 1)
  //   │    └─> u2_a
  //   │         └─> a2_a
  //   └─> a1_regen (branch 2 - regenerated assistant message)
  //
  // Sibling root (edited user message): u1_edit
  //   └─> a1_edit
  const messages = [
    { id: 'u1', role: 'user', content: 'Prompt 1', parentId: null, children: ['a1', 'a1_regen'] },
    { id: 'a1', role: 'assistant', content: 'Response 1', parentId: 'u1', children: ['u2_a'] },
    { id: 'u2_a', role: 'user', content: 'Follow-up A', parentId: 'a1', children: ['a2_a'] },
    { id: 'a2_a', role: 'assistant', content: 'Response 2A', parentId: 'u2_a', children: [] },
    { id: 'a1_regen', role: 'assistant', content: 'Response 1 Regenerated', parentId: 'u1', children: [] },
    { id: 'u1_edit', role: 'user', content: 'Prompt 1 Edited', parentId: null, children: ['a1_edit'] },
    { id: 'a1_edit', role: 'assistant', content: 'Response 1 to Edit', parentId: 'u1_edit', children: [] },
  ];

  await t.test('getActiveBranch correctly traverses branch 1 from leaf a2_a', () => {
    const branch1 = getActiveBranch(messages, 'a2_a');
    assert.deepEqual(
      branch1.map((m) => m.id),
      ['u1', 'a1', 'u2_a', 'a2_a']
    );
  });

  await t.test('getActiveBranch correctly traverses branch 2 from regenerated leaf a1_regen and posterior messages disappear', () => {
    const branch2 = getActiveBranch(messages, 'a1_regen');
    assert.deepEqual(
      branch2.map((m) => m.id),
      ['u1', 'a1_regen']
    );
    // u2_a and a2_a are not in branch 2!
    assert.ok(!branch2.some((m) => m.id === 'u2_a'));
    assert.ok(!branch2.some((m) => m.id === 'a2_a'));
  });

  await t.test('getActiveBranch correctly traverses edited root branch from leaf a1_edit', () => {
    const branchEdit = getActiveBranch(messages, 'a1_edit');
    assert.deepEqual(
      branchEdit.map((m) => m.id),
      ['u1_edit', 'a1_edit']
    );
  });

  await t.test('getMessageSiblings correctly identifies siblings and index for regenerated assistant message', () => {
    const sib1 = getMessageSiblings(messages, 'a1');
    assert.deepEqual(sib1.siblings, ['a1', 'a1_regen']);
    assert.equal(sib1.currentIndex, 0);

    const sib2 = getMessageSiblings(messages, 'a1_regen');
    assert.deepEqual(sib2.siblings, ['a1', 'a1_regen']);
    assert.equal(sib2.currentIndex, 1);
  });

  await t.test('getMessageSiblings correctly identifies siblings and index for edited user message at root', () => {
    const userSib1 = getMessageSiblings(messages, 'u1');
    assert.deepEqual(userSib1.siblings, ['u1', 'u1_edit']);
    assert.equal(userSib1.currentIndex, 0);

    const userSib2 = getMessageSiblings(messages, 'u1_edit');
    assert.deepEqual(userSib2.siblings, ['u1', 'u1_edit']);
    assert.equal(userSib2.currentIndex, 1);
  });

  await t.test('findDeepestLeafId traverses down to the active leaf of a branch', () => {
    // From u1, child path u1 -> a1_regen (last child)
    assert.equal(findDeepestLeafId(messages, 'u1'), 'a1_regen');
    // From a1, child path a1 -> u2_a -> a2_a
    assert.equal(findDeepestLeafId(messages, 'a1'), 'a2_a');
    // From u1_edit, child path u1_edit -> a1_edit
    assert.equal(findDeepestLeafId(messages, 'u1_edit'), 'a1_edit');
  });

  await t.test('Legacy flat messages without parentId work smoothly without errors', () => {
    const legacyMessages = [
      { id: 'm1', role: 'user', content: 'Old user' },
      { id: 'm2', role: 'assistant', content: 'Old assistant' },
    ];
    const branch = getActiveBranch(legacyMessages);
    assert.equal(branch.length, 2);
    assert.equal(branch[0].id, 'm1');
    assert.equal(branch[1].id, 'm2');

    const siblings = getMessageSiblings(legacyMessages, 'm1');
    assert.deepEqual(siblings.siblings, ['m1']);
    assert.equal(siblings.currentIndex, 0);
  });
});

test('Workspace Tools: File Presentation & Selective Editing', async (t) => {
  const storage = new MemoryStorageAdapter();
  const vfs = new VirtualFileSystem('user-1', storage);

  let presentedArtifact = null;
  let updatedPath = null;
  let updatedContent = null;

  const toolManager = new ToolManager({
    vfs,
    onPresentArtifact: (art) => {
      presentedArtifact = art;
    },
    onUpdateArtifactFile: (path, content) => {
      updatedPath = path;
      updatedContent = content;
    },
  });

  await t.test('workspace_write_file stores files in VFS without automatically presenting them', async () => {
    const res = await toolManager.executeTool({
      id: 'call-write-1',
      name: 'workspace_write_file',
      args: {
        path: '/scripts/analysis.py',
        content: 'import math\nprint(math.pi)\n',
      },
      userId: 'user-1',
      conversationId: 'conv-101',
    });

    assert.equal(res.isError, undefined);
    assert.equal(res.result.path, '/scripts/analysis.py');
    // Verify file is in VFS
    assert.equal(await vfs.exists('/scripts/analysis.py'), true);
    // Crucial check: onPresentArtifact was NOT called
    assert.equal(presentedArtifact, null);
  });

  await t.test('workspace_present_file explicitly presents an existing file as an artifact', async () => {
    // Write markdown document first
    await vfs.writeFile('/docs/report.md', '# Q3 Summary\n\nRevenue up 20%.\n');

    const res = await toolManager.executeTool({
      id: 'call-present-1',
      name: 'workspace_present_file',
      args: {
        path: '/docs/report.md',
        title: 'Q3 Financial Report',
      },
      userId: 'user-1',
      conversationId: 'conv-101',
    });

    assert.equal(res.isError, undefined);
    assert.equal(res.result.success, true);
    assert.equal(res.result.path, '/docs/report.md');
    assert.equal(res.result.title, 'Q3 Financial Report');

    // Verify onPresentArtifact was dispatched with proper metadata
    assert.ok(presentedArtifact !== null);
    assert.equal(presentedArtifact.title, 'Q3 Financial Report');
    assert.equal(presentedArtifact.filename, 'report.md');
    assert.equal(presentedArtifact.language, 'markdown');
    assert.equal(presentedArtifact.type, 'document');
    assert.equal(presentedArtifact.content, '# Q3 Summary\n\nRevenue up 20%.\n');
    assert.equal(presentedArtifact.conversationId, 'conv-101');
  });

  await t.test('workspace_present_file returns error when file does not exist', async () => {
    const res = await toolManager.executeTool({
      id: 'call-present-fail',
      name: 'workspace_present_file',
      args: {
        path: '/docs/nonexistent.md',
      },
      userId: 'user-1',
    });

    assert.equal(res.isError, true);
    assert.ok(res.error?.includes('File not found') || res.error?.includes('nonexistent.md'));
  });

  await t.test('workspace_edit_file with target_string replaces matching substring and notifies listener', async () => {
    const res = await toolManager.executeTool({
      id: 'call-edit-str',
      name: 'workspace_edit_file',
      args: {
        path: '/docs/report.md',
        target_string: 'Revenue up 20%.',
        replacement_string: 'Revenue up 35% with record margins.',
      },
      userId: 'user-1',
    });

    assert.equal(res.isError, undefined);
    assert.equal(res.result.success, true);

    // Verify VFS file was updated
    const saved = await vfs.readFile('/docs/report.md');
    assert.equal(saved, '# Q3 Summary\n\nRevenue up 35% with record margins.\n');

    // Verify onUpdateArtifactFile was called
    assert.equal(updatedPath, '/docs/report.md');
    assert.equal(updatedContent, '# Q3 Summary\n\nRevenue up 35% with record margins.\n');
  });

  await t.test('workspace_edit_file with non-matching target_string returns clear error', async () => {
    const res = await toolManager.executeTool({
      id: 'call-edit-str-fail',
      name: 'workspace_edit_file',
      args: {
        path: '/docs/report.md',
        target_string: 'This text definitely does not exist',
        replacement_string: 'replacement',
      },
      userId: 'user-1',
    });

    assert.equal(res.isError, true);
    assert.ok(res.error?.includes('Target string was not found'));
  });

  await t.test('workspace_edit_file with line-range replaces specified lines', async () => {
    // Write multi-line code file
    const initialCode = 'line 1\nline 2 to replace\nline 3 to replace\nline 4';
    await vfs.writeFile('/scripts/lines.txt', initialCode);

    const res = await toolManager.executeTool({
      id: 'call-edit-line',
      name: 'workspace_edit_file',
      args: {
        path: '/scripts/lines.txt',
        start_line: 2,
        end_line: 3,
        replacement_content: 'new line 2 and 3 combined',
      },
      userId: 'user-1',
    });

    assert.equal(res.isError, undefined);
    assert.equal(res.result.success, true);

    const updated = await vfs.readFile('/scripts/lines.txt');
    assert.equal(updated, 'line 1\nnew line 2 and 3 combined\nline 4');
    assert.equal(updatedPath, '/scripts/lines.txt');
    assert.equal(updatedContent, 'line 1\nnew line 2 and 3 combined\nline 4');
  });

  await t.test('workspace_edit_file calculates added and removed diff counts accurately', async () => {
    await vfs.writeFile('/src/app.js', 'console.log("hello");\nlet a = 1;');

    const res = await toolManager.executeTool({
      id: 'call-edit-diff',
      name: 'workspace_edit_file',
      args: {
        path: '/src/app.js',
        target_string: 'let a = 1;',
        replacement_string: 'let a = 2;\nlet b = 3;\nlet c = 4;',
      },
      userId: 'user-1',
    });

    assert.equal(res.isError, undefined);
    assert.deepEqual(res.result.diff, { added: 3, removed: 1 });
  });

  await t.test('agent_note tool records note successfully', async () => {
    const res = await toolManager.executeTool({
      id: 'call-note-1',
      name: 'agent_note',
      args: {
        note: 'Verificando coherencia del archivo',
      },
      userId: 'user-1',
    });

    assert.equal(res.isError, undefined);
    assert.equal(res.result.success, true);
    assert.equal(res.result.note, 'Verificando coherencia del archivo');
  });

  await t.test('formatExecutionSummary matches Claude header format in Spanish and English', () => {
    const steps = [
      { id: '1', kind: 'edit', title: 'Edit 1' },
      { id: '2', kind: 'read', title: 'Read 1' },
      { id: '3', kind: 'command', title: 'Command 1' },
      { id: '4', kind: 'command', title: 'Command 2' },
      { id: '5', kind: 'note', title: 'Note 1' },
      { id: '6', kind: 'note', title: 'Note 2' },
    ];

    const esSummary = formatExecutionSummary(steps, 'es');
    assert.equal(esSummary, '1 archivo editado, leyó 1 archivo, ejecutó 2 comandos · 2 notas');

    const enSummary = formatExecutionSummary(steps, 'en');
    assert.equal(enSummary, '1 file edited, read 1 file, executed 2 commands · 2 notes');
  });
});


