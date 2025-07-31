<script lang="ts">
  import { onMount } from 'svelte';
  import { entryStore } from '../stores/entries.js';
  import { tagStore, tags } from '../stores/tags.js';
  import { capitalize } from '../utils/text.js';
  import { db, type JournalEntry } from '../database/db.js';

  export let entry: JournalEntry | null = null;
  export let onSave: (() => void) | undefined = undefined;

  let title = entry?.title || '';
  let content = entry?.content || '';
  let selectedTags = entry?.tags || [];
  let isEditing = !entry;
  let showEntryMenu = false;
  let showMoveToModal = false;
  let selectedMoveTags: string[] = [];
  let showTagsModal = false;
  
  // Auto-save state
  let autoSaveTimer: number | null = null;
  let showAutoSaveIndicator = false;
  let hasStartedTimer = false;
  let autoSavedEntryId: number | null = null;
  let autoSaveEnabled = true;

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      clearAutoSaveTimer();
    };
  });

  // Reactive statements to manage auto-save timer for both new and existing entries
  $: {
    if (isEditing && autoSaveEnabled) {
      // Start auto-save timer when content changes (for both new and existing entries)
      if ((title.trim() || content.trim()) && !hasStartedTimer) {
        startAutoSaveTimer();
        hasStartedTimer = true;
      }
    } else {
      // Not editing or auto-save disabled, clear timer and reset auto-save state
      clearAutoSaveTimer();
      hasStartedTimer = false;
      if (!autoSaveEnabled) {
        autoSavedEntryId = null;
      }
    }
  }

  async function saveEntry() {
    if (!title.trim() || !content.trim()) return;

    const now = new Date();
    const entryData = {
      title: title.trim(),
      content: content.trim(),
      timestamp: entry?.timestamp || now,
      createdAt: entry?.createdAt || now,
      lastEditedAt: now,
      tags: selectedTags,
    };

    // Update tag usage counts
    if (entry?.id) {
      await tagStore.updateTagsUsage(entry.tags || [], selectedTags);
      await entryStore.update(entry.id, entryData);
    } else if (autoSavedEntryId) {
      // This was an auto-saved entry, update it and reload store
      await entryStore.update(autoSavedEntryId, entryData);
    } else {
      // For new entries, create tags if they don't exist, then increment usage
      for (const tagName of selectedTags) {
        await tagStore.create(tagName);
        await tagStore.incrementUsage(tagName);
      }
      await entryStore.create(entryData);
    }

    if (onSave) onSave();
    isEditing = false;
  }


  function openTagsModal() {
    showTagsModal = true;
  }

  function closeTagsModal() {
    showTagsModal = false;
  }

  function toggleTag(tagName: string) {
    if (selectedTags.includes(tagName)) {
      selectedTags = selectedTags.filter(t => t !== tagName);
    } else {
      selectedTags = [...selectedTags, tagName];
    }
  }

  async function createNewTag(tagName: string) {
    const trimmedTag = tagName.toLowerCase().trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      selectedTags = [...selectedTags, trimmedTag];
      await tagStore.create(trimmedTag);
    }
  }

  async function autoSave() {
    // Check if we have content to save (title or content)
    const hasTitle = title.trim().length > 0;
    const hasContent = content.trim().length > 0;
    
    if (!hasTitle && !hasContent) {
      return;
    }
    
    showAutoSaveIndicator = true;
    
    // Add a small delay so you can see the indicator
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const now = new Date();
      const entryData = {
        title: hasTitle ? title.trim() : 'Untitled',
        content: content.trim(),
        timestamp: entry?.timestamp || now,
        createdAt: entry?.createdAt || now,
        lastEditedAt: now,
        tags: selectedTags,
      };

      if (entry?.id) {
        // Auto-save existing entry being edited - update directly without reloading store
        await db.entries.update(entry.id, entryData);
      } else if (autoSavedEntryId) {
        // Update existing auto-saved entry directly without reloading store
        await db.entries.update(autoSavedEntryId, entryData);
      } else {
        // Create new entry on first auto-save directly without reloading store
        const createdId = await db.entries.add(entryData);
        autoSavedEntryId = createdId || null;
        
        // Update tag usage counts only on first save
        for (const tagName of selectedTags) {
          await tagStore.create(tagName);
          await tagStore.incrementUsage(tagName);
        }
      }
      
      // Hide indicator after a moment
      setTimeout(() => {
        showAutoSaveIndicator = false;
      }, 2000);
      
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  function startAutoSaveTimer() {
    clearAutoSaveTimer();
    autoSaveTimer = window.setTimeout(() => {
      autoSave();
      // Restart timer for recurring auto-saves (for both new and existing entries)
      if (isEditing && autoSaveEnabled && (title.trim() || content.trim())) {
        startAutoSaveTimer();
      }
    }, 30 * 1000); // 30 seconds for testing
  }

  function clearAutoSaveTimer() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  function startEditing() {
    isEditing = true;
  }

  function toggleEntryMenu() {
    showEntryMenu = !showEntryMenu;
  }

  async function deleteEntry() {
    if (!entry?.id) return;
    
    const confirmDelete = confirm('Are you sure you want to delete this entry?\n\nThis action cannot be undone.');
    
    if (!confirmDelete) {
      return;
    }

    try {
      await entryStore.delete(entry.id);
      if (onSave) onSave();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  }

  function openMoveToModal() {
    if (!entry) return;
    selectedMoveTags = entry.tags ? [...entry.tags] : [];
    showMoveToModal = true;
    showEntryMenu = false;
  }

  function closeMoveToModal() {
    showMoveToModal = false;
    selectedMoveTags = [];
  }

  function toggleMoveToTag(tagName: string) {
    if (selectedMoveTags.includes(tagName)) {
      selectedMoveTags = selectedMoveTags.filter(t => t !== tagName);
    } else {
      selectedMoveTags = [...selectedMoveTags, tagName];
    }
  }

  async function saveMoveToTags() {
    if (!entry?.id) return;

    try {
      const oldTags = entry.tags || [];
      await entryStore.update(entry.id, { tags: selectedMoveTags });
      await tagStore.updateTagsUsage(oldTags, selectedMoveTags);
      
      // Update the current entry object
      entry.tags = selectedMoveTags;
      selectedTags = selectedMoveTags;
      
      await tagStore.loadAll();
      closeMoveToModal();
    } catch (error) {
      console.error('Error updating entry tags:', error);
      alert('Failed to update entry tags');
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.entry-menu-container')) {
      showEntryMenu = false;
    }
  }

</script>

<div class="h-full overflow-y-auto" style="background: var(--background-secondary);">
  <!-- Auto-save indicator at top center -->
  {#if showAutoSaveIndicator}
    <div style="position: fixed; top: var(--space-4); left: 50%; transform: translateX(-50%); z-index: 50; padding: var(--space-2) var(--space-4); background: var(--accent-blue); color: white; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: var(--font-medium); box-shadow: 0 2px 8px var(--shadow-hover);">
      Autosaving...
    </div>
  {/if}
  
  <div class="editor-container" style="margin: var(--space-12) auto; max-width: 800px; padding: var(--space-12) var(--space-8);">
  {#if isEditing}
    <div style="display: flex; flex-direction: column; gap: var(--space-1);">
      <!-- Title Input and Auto-save Toggle -->
      <div style="position: relative;">
        <input
          bind:value={title}
          placeholder="Entry title..."
          class="editor-title"
          maxlength="200"
        />
        
        <!-- Auto-save toggle aligned with title divider -->
        <div style="position: absolute; top: 0; right: 0; display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-secondary);">
          <span>Auto-save</span>
          <label class="toggle-switch" style="position: relative; display: inline-block; width: 32px; height: 16px;">
            <input
              type="checkbox"
              bind:checked={autoSaveEnabled}
              style="opacity: 0; width: 0; height: 0;"
            />
            <span class="toggle-slider" style="
              position: absolute;
              cursor: pointer;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: {autoSaveEnabled ? 'var(--accent-blue)' : 'var(--background-tertiary)'};
              transition: 0.3s;
              border-radius: 16px;
            ">
              <span style="
                position: absolute;
                content: '';
                height: 12px;
                width: 12px;
                left: {autoSaveEnabled ? '18px' : '2px'};
                bottom: 2px;
                background: white;
                transition: 0.3s;
                border-radius: 50%;
                box-shadow: 0 1px 3px var(--shadow);
              "></span>
            </span>
          </label>
        </div>
        
        <!-- Divider -->
        <div style="border-bottom: 1px solid var(--border-light); margin: 0;"></div>
        
        <!-- Timestamp -->
        <div style="margin-bottom: var(--space-3);">
          <div style="font-size: var(--text-xs); color: var(--text-tertiary);">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
      
      <!-- Content Textarea -->
      <div>
        <textarea
          bind:value={content}
          placeholder="What's on your mind?"
          class="editor-content"
          rows="20"
        ></textarea>
      </div>

      <!-- Action Buttons -->
      <div class="editor-meta">
        <button
          onclick={saveEntry}
          class="btn-primary"
          disabled={!title.trim() || !content.trim()}
        >
          Save Entry
        </button>
        
        <button
          onclick={openTagsModal}
          class="btn-secondary"
          title="Manage Tags"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
        
        
        <div class="ml-auto" style="display: flex; gap: var(--space-4); font-size: var(--text-xs); color: var(--text-secondary);">
          {#if content.trim()}
            <span>{content.trim().split(/\s+/).length} words</span>
          {/if}
        </div>
      </div>
    </div>
  {:else if entry}
    <div style="display: flex; flex-direction: column; gap: var(--space-6);">
      <!-- Header -->
      <div class="flex justify-between items-start relative">
        <div class="flex-1">
          <h1 style="font-size: var(--text-3xl); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-2);">
            {capitalize(entry.title)}
          </h1>
          {#if entry.timestamp}
            <div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: var(--space-1);">
              <div>Created on {new Date(entry.createdAt || entry.timestamp).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}</div>
              {#if entry.lastEditedAt && entry.lastEditedAt.getTime() !== (entry.createdAt || entry.timestamp).getTime()}
                <div>Last edited on {new Date(entry.lastEditedAt).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}</div>
              {/if}
            </div>
          {/if}
        </div>
        
        <div class="flex items-center gap-2">
          <button
            onclick={startEditing}
            title="Edit entry"
            style="padding: var(--space-2); background: transparent; border: none; color: var(--text-tertiary); cursor: pointer; transition: color 0.2s ease;"
            onmouseenter={(e) => (e.target as HTMLElement).style.color = 'var(--text-secondary)'}
            onmouseleave={(e) => (e.target as HTMLElement).style.color = 'var(--text-tertiary)'}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          
          <div class="relative entry-menu-container">
            <button
              onclick={toggleEntryMenu}
              class="p-2 rounded-md hover:bg-opacity-20 transition-colors"
              style="color: var(--text-tertiary); background: transparent;"
              title="Entry options"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
              </svg>
            </button>
            
            {#if showEntryMenu}
              <div class="absolute right-0 top-full mt-1 w-40 rounded-lg z-20" style="background: var(--background-primary); border: 1px solid var(--border-light); box-shadow: 0 4px 12px var(--shadow-hover);">
                <div class="py-1">
                  <button
                    onclick={openMoveToModal}
                    class="w-full text-left px-3 py-2 hover:bg-opacity-50 transition-colors flex items-center gap-2"
                    style="color: var(--text-primary); font-size: var(--text-sm);"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Move to
                  </button>
                  <button
                    onclick={deleteEntry}
                    class="w-full text-left px-3 py-2 hover:bg-red-50 transition-colors flex items-center gap-2"
                    style="color: var(--text-red); font-size: var(--text-sm);"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Content -->
      <div class="whitespace-pre-wrap" style="font-size: var(--text-lg); color: var(--text-primary); line-height: 1.7;">
        {entry.content}
      </div>

      <!-- Tags and Word Count Display -->
      <div style="padding-top: var(--space-4); border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
        {#if entry.tags && entry.tags.length > 0}
          <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
            {entry.tags.map(tag => capitalize(tag)).join(' | ')}
          </span>
        {:else}
          <span></span>
        {/if}
        <span style="font-size: var(--text-xs); color: var(--text-secondary);">
          {entry.content.trim().split(/\s+/).length} words
        </span>
      </div>
    </div>
  {/if}
  </div>
</div>

<!-- Move To Modal -->
{#if showMoveToModal && entry}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={closeMoveToModal}>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" style="background: var(--background-primary);" onclick={(e) => e.stopPropagation()}>
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Move Entry to Tags</h3>
        
        <div class="max-h-60 overflow-y-auto mb-6">
          {#if $tags.length === 0}
            <p class="text-center py-4" style="color: var(--text-secondary); font-size: var(--text-sm);">No tags available</p>
          {:else}
            <div class="space-y-2">
              {#each $tags.sort((a, b) => b.usageCount - a.usageCount) as tag}
                <label class="flex items-center cursor-pointer p-2 rounded-lg hover:bg-opacity-50 transition-colors" style="gap: var(--space-3);">
                  <input
                    type="checkbox"
                    checked={selectedMoveTags.includes(tag.name)}
                    onchange={() => toggleMoveToTag(tag.name)}
                    class="w-4 h-4 rounded"
                    style="color: var(--accent-blue);"
                  />
                  <span 
                    class="w-3 h-3 rounded-full"
                    style="background-color: {tag.color}"
                  ></span>
                  <span class="flex-1" style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">{capitalize(tag.name)}</span>
                  <span style="font-size: var(--text-xs); color: var(--text-secondary); padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); background: var(--background-tertiary);">{tag.usageCount}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex justify-end gap-3">
          <button
            onclick={closeMoveToModal}
            class="px-4 py-2 rounded-lg transition-colors"
            style="color: var(--text-secondary); background: var(--background-tertiary);"
          >
            Cancel
          </button>
          <button
            onclick={saveMoveToTags}
            class="px-4 py-2 rounded-lg transition-colors"
            style="color: white; background: var(--accent-blue);"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Tags Modal -->
{#if showTagsModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onclick={closeTagsModal}>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" style="background: var(--background-primary);" onclick={(e) => e.stopPropagation()}>
      <div class="p-4">
        <!-- Selected Tags Display -->
        {#if selectedTags.length > 0}
          <div class="mb-3">
            <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-1);">Selected:</p>
            <div class="flex flex-wrap gap-1">
              {#each selectedTags as tag}
                <div 
                  class="inline-flex items-center transition-fast"
                  style="padding: var(--space-1) var(--space-2); font-size: var(--text-xs); color: var(--text-primary); border: 1px solid var(--border-light); border-radius: var(--radius-sm); background: var(--background-secondary);"
                >
                  {capitalize(tag)}
                  <button
                    onclick={() => toggleTag(tag)}
                    class="rounded-full transition-fast"
                    style="margin-left: var(--space-1); padding: 1px; opacity: 0.7; color: var(--text-secondary);"
                    title="Remove tag"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- Create New Tag -->
        <div class="mb-3">
          <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-1);">Create new tag</label>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Tag name..."
              class="flex-1"
              style="padding: var(--space-2); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--background-secondary); color: var(--text-primary); font-size: var(--text-sm);"
              onkeydown={(e) => {
                const target = e.target as HTMLInputElement;
                if (e.key === 'Enter' && target.value.trim()) {
                  createNewTag(target.value.trim());
                  target.value = '';
                }
              }}
            />
            <button
              onclick={(e) => {
                const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                if (input?.value.trim()) {
                  createNewTag(input.value.trim());
                  input.value = '';
                }
              }}
              class="px-3 py-2 rounded-md transition-colors"
              style="background: var(--accent-blue); color: white; border: none; font-size: var(--text-sm);"
            >
              Add
            </button>
          </div>
        </div>
        
        <!-- Existing Tags -->
        <div class="max-h-48 overflow-y-auto mb-4">
          <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-1);">Existing tags</label>
          {#if $tags.length === 0}
            <p class="text-center py-2" style="color: var(--text-secondary); font-size: var(--text-sm);">No tags available</p>
          {:else}
            <div class="space-y-1">
              {#each $tags.sort((a, b) => b.usageCount - a.usageCount) as tag}
                <label class="flex items-center cursor-pointer p-1 rounded transition-colors" style="gap: var(--space-2);">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.name)}
                    onchange={() => toggleTag(tag.name)}
                    class="w-4 h-4 rounded"
                    style="color: var(--accent-blue);"
                  />
                  <span class="flex-1" style="font-size: var(--text-sm); color: var(--text-primary);">{capitalize(tag.name)}</span>
                  <span style="font-size: var(--text-xs); color: var(--text-secondary);">{tag.usageCount}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex justify-end">
          <button
            onclick={closeTagsModal}
            class="px-4 py-2 rounded-lg transition-colors"
            style="color: white; background: var(--accent-blue);"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}