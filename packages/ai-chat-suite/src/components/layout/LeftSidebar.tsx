import React, { useState } from 'react';
import {
  FolderPlus,
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Edit2,
  ShieldAlert,
  PanelLeftClose,
  Pin,
  MoreVertical,
  Check,
  X,
} from 'lucide-react';
import { Conversation, Folder } from '../../types/chat';

export interface LeftSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: (isEphemeral?: boolean) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onMoveConversationToFolder: (convId: string, folderId: string | null) => void;

  // Folder props
  folders: Folder[];
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;

  allowEphemeralChats?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onMoveConversationToFolder,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  allowEphemeralChats = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editConvTitle, setEditConvTitle] = useState('');
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolderSubmit = (id: string) => {
    if (editFolderName.trim()) {
      onRenameFolder(id, editFolderName.trim());
    }
    setEditingFolderId(null);
  };

  const handleRenameConvSubmit = (id: string) => {
    if (editConvTitle.trim()) {
      onRenameConversation(id, editConvTitle.trim());
    }
    setEditingConvId(null);
  };

  const filteredConversations = conversations.filter(
    (c) =>
      !c.isEphemeral &&
      c.messages &&
      c.messages.length > 0 &&
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unfiledConversations = filteredConversations.filter((c) => !c.folderId);

  return (
    <aside className="w-72 flex-shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#18181a] flex flex-col transition-all select-none">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm text-slate-800 dark:text-slate-200">
          <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          <span>Conversations</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title="Close Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="p-3 flex flex-col gap-2">
        <button
          onClick={() => onNewConversation(false)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>

        {allowEphemeralChats && (
          <button
            onClick={() => onNewConversation(true)}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-dashed border-amber-600/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium transition-colors"
            title="Non-persistent incognito session - not saved to history"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Incognito / Ephemeral Chat</span>
          </button>
        )}

        {/* Search */}
        <div className="relative mt-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Folders & History Scrollable List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
        {/* Folders Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Folders</span>
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="p-0.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Create new folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add folder inline form */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-1 px-2 py-1">
              <input
                autoFocus
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="p-1 text-emerald-600 hover:text-emerald-700"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Folders List */}
          <div className="space-y-0.5 mt-1">
            {folders.map((folder) => {
              const isExpanded = !!expandedFolders[folder.id];
              const folderConvs = filteredConversations.filter((c) => c.folderId === folder.id);

              return (
                <div key={folder.id} className="rounded-md overflow-hidden">
                  <div className="group flex items-center justify-between px-2 py-1.5 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded text-xs text-slate-700 dark:text-slate-300 transition-colors">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex items-center gap-1.5 flex-1 text-left truncate"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                      ) : (
                        <FolderIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                      )}

                      {editingFolderId === folder.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editFolderName}
                          onChange={(e) => setEditFolderName(e.target.value)}
                          onBlur={() => handleRenameFolderSubmit(folder.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameFolderSubmit(folder.id)}
                          className="px-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-amber-500 text-xs text-slate-900 dark:text-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate font-medium">{folder.name}</span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-1">({folderConvs.length})</span>
                    </button>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingFolderId(folder.id);
                          setEditFolderName(folder.name);
                        }}
                        className="p-1 hover:text-amber-600"
                        title="Rename folder"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteFolder(folder.id)}
                        className="p-1 hover:text-rose-500"
                        title="Delete folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Folder Conversations List */}
                  {isExpanded && (
                    <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3 my-0.5">
                      {folderConvs.map((conv) => renderConversationItem(conv))}
                      {folderConvs.length === 0 && (
                        <div className="px-2 py-1 text-[11px] text-slate-400 italic">No chats in folder</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unfiled / Recent Conversations */}
        <div>
          <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Recent Chats</span>
          </div>
          <div className="space-y-0.5 mt-1">
            {unfiledConversations.map((conv) => renderConversationItem(conv))}
            {unfiledConversations.length === 0 && (
              <div className="px-2 py-2 text-xs text-slate-400 italic text-center">
                {searchQuery ? 'No chats match search' : 'No chats yet'}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );

  function renderConversationItem(conv: Conversation) {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingConvId === conv.id;
    const isMenuOpen = activeMenuConvId === conv.id;

    return (
      <div
        key={conv.id}
        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
          isActive
            ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-medium'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
        }`}
        onClick={() => onSelectConversation(conv.id)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-1">
          {conv.isEphemeral ? (
            <span title="Ephemeral Chat" className="flex-shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            </span>
          ) : (
            <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )}

          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={editConvTitle}
              onChange={(e) => setEditConvTitle(e.target.value)}
              onBlur={() => handleRenameConvSubmit(conv.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameConvSubmit(conv.id)}
              className="w-full px-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-amber-500 text-xs text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate">{conv.title || 'Untitled Chat'}</span>
          )}
        </div>

        {/* Action Menu button */}
        <div
          className={`flex items-center gap-1 transition-opacity ${
            isActive || isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setActiveMenuConvId(isMenuOpen ? null : conv.id)}
            className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700/60 text-slate-500"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-2 top-8 z-50 w-44 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1 text-xs text-slate-700 dark:text-slate-200">
              <button
                onClick={() => {
                  setEditingConvId(conv.id);
                  setEditConvTitle(conv.title);
                  setActiveMenuConvId(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                <Edit2 className="w-3 h-3 text-slate-400" />
                <span>Rename</span>
              </button>

              {/* Move to folder submenu */}
              {folders.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 my-1 py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase">
                    Move to folder
                  </div>
                  {conv.folderId && (
                    <button
                      onClick={() => {
                        onMoveConversationToFolder(conv.id, null);
                        setActiveMenuConvId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1 text-left text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>(Remove from folder)</span>
                    </button>
                  )}
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onMoveConversationToFolder(conv.id, f.id);
                        setActiveMenuConvId(null);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 truncate ${
                        conv.folderId === f.id ? 'font-semibold text-amber-600' : ''
                      }`}
                    >
                      <FolderIcon className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

              <button
                onClick={() => {
                  onDeleteConversation(conv.id);
                  setActiveMenuConvId(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-left"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
};
