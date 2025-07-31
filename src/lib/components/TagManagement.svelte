<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tags, tagStore } from '../stores/tags.js';
  import { capitalize } from '../utils/text.js';
  import type { JournalEntry, Tag } from '../database/db.js';

  export let onSelectEntry: ((entry: JournalEntry) => void) | undefined = undefined;

  let expandedTags: Set<string> = new Set();
  let editingTag: string | null = null;
  let editTagName: string = '';
  let editTagInput: HTMLInputElement;
  let preventBlurSave = false;
  let isCreatingNewTag = false;
  let newTagName = '';
  let newTagInput: HTMLInputElement;
  let tagEntries: { [tagName: string]: JournalEntry[] } = {};
  let activeMenuEntryId: number | null = null;
  let showMoveToModal = false;
  let moveToEntryId: number | null = null;
  let selectedMoveTags: string[] = [];

  onMount(() => {
    entryStore.loadAll();
    tagStore.loadAll();
    document.addEventListener('click', handleEntryClickOutside);
    return () => {
      document.removeEventListener('click', handleEntryClickOutside);
    };
  });

  $: if ($entries.length || $tags.length) {
    groupEntriesByTag();
  }

  function groupEntriesByTag() {
    tagEntries = {};
    $tags.forEach(tag => {
      tagEntries[tag.name] = $entries.filter(entry => 
        entry.tags && entry.tags.includes(tag.name)
      ).sort((a, b) => new Date(b.lastEditedAt || b.timestamp).getTime() - new Date(a.lastEditedAt || a.timestamp).getTime());
    });
  }

  function toggleTag(tagName: string) {
    if (expandedTags.has(tagName)) {
      expandedTags.delete(tagName);
    } else {
      expandedTags.add(tagName);
    }
    expandedTags = new Set(expandedTags);
  }

  function startEditingTag(tagName: string) {
    editingTag = tagName;
    editTagName = capitalize(tagName);
    setTimeout(() => {
      editTagInput?.focus();
      editTagInput?.select();
    }, 0);
  }

  async function saveTagName() {
    if (!editingTag || !editTagName.trim()) {
      cancelEditing();
      return;
    }

    const newTagName = capitalize(editTagName.trim().toLowerCase());
    const oldTagName = editingTag;

    if (newTagName === oldTagName) {
      cancelEditing();
      return;
    }

    // Check if new tag name already exists (excluding the current tag being edited)
    const existingTag = $tags.find(t => t.name === newTagName.toLowerCase() && t.name !== oldTagName);
    if (existingTag) {
      alert('A tag with this name already exists');
      return;
    }

    try {
      // Update all entries that use this tag
      const affectedEntries = $entries.filter(entry => 
        entry.tags && entry.tags.includes(oldTagName)
      );

      for (const entry of affectedEntries) {
        if (entry.tags) {
          const updatedTags = entry.tags.map(tag => 
            tag === oldTagName ? newTagName.toLowerCase() : tag
          );
          await entryStore.update(entry.id!, { tags: updatedTags });
        }
      }

      // Update the tag in the tags table
      const tag = $tags.find(t => t.name === oldTagName);
      if (tag) {
        await tagStore.updateTagName(tag.id!, newTagName.toLowerCase());
      }

      // Reload data
      await entryStore.loadAll();
      await tagStore.loadAll();
      
      cancelEditing();
    } catch (error) {
      console.error('Error renaming tag:', error);
      alert('Failed to rename tag');
    }
  }

  function cancelEditing() {
    editingTag = null;
    editTagName = '';
  }

  function handleTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      preventBlurSave = true;
      saveTagName();
    } else if (event.key === 'Escape') {
      preventBlurSave = true;
      cancelEditing();
    }
  }

  function handleTagBlur() {
    if (preventBlurSave) {
      preventBlurSave = false;
      return;
    }
    saveTagName();
  }

  function selectEntry(entry: JournalEntry) {
    if (onSelectEntry) {
      onSelectEntry(entry);
    }
  }

  function formatEntryDate(entry: JournalEntry): string {
    const date = new Date(entry.lastEditedAt || entry.timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  }

  function startCreatingNewTag() {
    isCreatingNewTag = true;
    newTagName = '';
    setTimeout(() => {
      newTagInput?.focus();
    }, 0);
  }

  async function createNewTag() {
    if (!newTagName.trim()) {
      cancelCreatingNewTag();
      return;
    }

    const tagName = capitalize(newTagName.trim().toLowerCase());

    // Check if tag already exists
    const existingTag = $tags.find(t => t.name === tagName.toLowerCase());
    if (existingTag) {
      alert('A tag with this name already exists');
      return;
    }

    try {
      await tagStore.create(tagName.toLowerCase());
      await tagStore.loadAll();
      cancelCreatingNewTag();
    } catch (error) {
      console.error('Error creating tag:', error);
      alert('Failed to create tag');
    }
  }

  function cancelCreatingNewTag() {
    isCreatingNewTag = false;
    newTagName = '';
  }

  function handleNewTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      createNewTag();
    } else if (event.key === 'Escape') {
      cancelCreatingNewTag();
    }
  }

  async function deleteTag(tagName: string) {
    const confirmDelete = confirm(`Are you sure you want to delete the tag "${capitalize(tagName)}"?\n\nThis will remove the tag from all entries that use it. This action cannot be undone.`);
    
    if (!confirmDelete) {
      return;
    }

    try {
      const tag = $tags.find(t => t.name === tagName);
      if (!tag) return;

      // Remove tag from all entries that use it
      const affectedEntries = $entries.filter(entry => 
        entry.tags && entry.tags.includes(tagName)
      );

      for (const entry of affectedEntries) {
        if (entry.tags) {
          const updatedTags = entry.tags.filter(t => t !== tagName);
          await entryStore.update(entry.id!, { tags: updatedTags });
        }
      }

      // Delete the tag from tags table
      if (tag.id) {
        await tagStore.deleteTag(tag.id);
      }

      // Reload data
      await entryStore.loadAll();
      await tagStore.loadAll();

      // Close expanded section if it was open
      if (expandedTags.has(tagName)) {
        expandedTags.delete(tagName);
        expandedTags = new Set(expandedTags);
      }

      // Cancel editing if this tag was being edited
      if (editingTag === tagName) {
        cancelEditing();
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Failed to delete tag');
    }
  }

  function handleEntryClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.entry-menu-container')) {
      activeMenuEntryId = null;
    }
  }

  function toggleEntryMenu(entryId: number, event: MouseEvent) {
    event.stopPropagation();
    activeMenuEntryId = activeMenuEntryId === entryId ? null : entryId;
  }

  async function deleteEntryFromTag(entryId: number) {
    const confirmDelete = confirm('Are you sure you want to delete this entry?\n\nThis action cannot be undone.');
    
    if (!confirmDelete) {
      return;
    }

    try {
      await entryStore.delete(entryId);
      await entryStore.loadAll();
      await tagStore.loadAll();
      activeMenuEntryId = null;
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  }

  function openMoveToModalFromTag(entryId: number) {
    moveToEntryId = entryId;
    const entry = $entries.find(e => e.id === entryId);
    selectedMoveTags = entry?.tags ? [...entry.tags] : [];
    showMoveToModal = true;
    activeMenuEntryId = null;
  }

  function closeMoveToModalFromTag() {
    showMoveToModal = false;
    moveToEntryId = null;
    selectedMoveTags = [];
  }

  function toggleMoveToTagFromTag(tagName: string) {
    if (selectedMoveTags.includes(tagName)) {
      selectedMoveTags = selectedMoveTags.filter(t => t !== tagName);
    } else {
      selectedMoveTags = [...selectedMoveTags, tagName];
    }
  }

  async function saveMoveToTagsFromTag() {
    if (moveToEntryId === null) return;

    try {
      const entry = $entries.find(e => e.id === moveToEntryId);
      if (entry) {
        const oldTags = entry.tags || [];
        await entryStore.update(moveToEntryId, { tags: selectedMoveTags });
        await tagStore.updateTagsUsage(oldTags, selectedMoveTags);
        await entryStore.loadAll();
        await tagStore.loadAll();
      }
      closeMoveToModalFromTag();
    } catch (error) {
      console.error('Error updating entry tags:', error);
      alert('Failed to update entry tags');
    }
  }
</script>

<div class="h-full overflow-y-auto p-8" style="background: var(--background-primary); font-family: var(--font-primary);">
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <div class="mb-8" style="padding: var(--space-3) var(--space-4);">
    </div>

    <!-- Create New Tag Section -->
    <div class="mb-6">
      {#if isCreatingNewTag}
        <div class="flex items-center gap-3 p-4 rounded-lg" style="background: var(--background-primary); border: 1px solid var(--border-light);">
          <input
            bind:this={newTagInput}
            bind:value={newTagName}
            onkeydown={handleNewTagKeydown}
            onblur={createNewTag}
            placeholder="Enter tag name..."
            class="flex-1 bg-transparent border-none outline-none"
            style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary);"
            maxlength="30"
          />
          <button
            onclick={cancelCreatingNewTag}
            class="p-1 rounded-md hover:bg-opacity-50 transition-colors"
            style="color: var(--text-secondary);"
            title="Cancel"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {:else}
        <button
          onclick={startCreatingNewTag}
          class="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed hover:border-solid transition-all duration-200"
          style="border-color: var(--border-light); color: var(--text-secondary); background: var(--background-primary);"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span style="font-weight: var(--font-medium);">Create New Tag</span>
        </button>
      {/if}
    </div>

    <!-- Tag List -->
    <div class="space-y-4">
      {#if $tags.length === 0}
        <div class="text-center py-16">
          <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style="background: var(--background-tertiary);">
            <svg class="w-8 h-8" style="color: var(--text-secondary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 style="font-size: var(--text-xl); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-3);">No tags yet</h3>
          <p style="color: var(--text-secondary);">Start writing entries with tags to see them organized here</p>
        </div>
      {:else}
        {#each $tags.sort((a, b) => b.usageCount - a.usageCount) as tag (tag.id)}
          <div class="tag-section">
            <!-- Tag Header -->
            <div 
              class="cursor-pointer transition-colors"
              style="padding: var(--space-3) 0; display: flex; align-items: center; justify-between;"
              onclick={() => toggleTag(tag.name)}
            >
              <div class="flex items-center justify-between w-full">
                <div>
                  {#if editingTag === tag.name}
                    <input
                      bind:this={editTagInput}
                      bind:value={editTagName}
                      onkeydown={handleTagKeydown}
                      onblur={handleTagBlur}
                      onclick={(e) => e.stopPropagation()}
                      class="bg-transparent border-none outline-none"
                      style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); min-width: 100px;"
                      maxlength="30"
                    />
                  {:else}
                    <h3 
                      style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0;"
                      ondblclick={(e) => { e.stopPropagation(); startEditingTag(tag.name); }}
                      title="Double-click to edit"
                    >
                      {capitalize(tag.name)}
                    </h3>
                  {/if}
                </div>
                
                <div class="flex items-center gap-2">
                  <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
                    {tag.usageCount} {tag.usageCount === 1 ? 'entry' : 'entries'}
                  </span>
                  
                  <button
                    onclick={(e) => { e.stopPropagation(); startEditingTag(tag.name); }}
                    class="p-1 rounded-md hover:bg-opacity-50 transition-colors"
                    style="color: var(--text-tertiary);"
                    title="Edit tag name"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  
                  <button
                    onclick={(e) => { e.stopPropagation(); deleteTag(tag.name); }}
                    class="p-1 rounded-md hover:bg-red-50 transition-colors"
                    style="color: var(--text-tertiary);"
                    title="Delete tag"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  
                  <svg 
                    class="w-4 h-4 transition-transform" 
                    style="color: var(--text-tertiary);" 
                    class:rotate-180={expandedTags.has(tag.name)}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <!-- Divider line -->
            <div style="border-bottom: 1px solid var(--border-light);"></div>

            <!-- Expanded Entries -->
            {#if expandedTags.has(tag.name)}
              <div style="padding-left: var(--space-4); padding-top: var(--space-2);">
                {#if tagEntries[tag.name] && tagEntries[tag.name].length > 0}
                  <div>
                    {#each tagEntries[tag.name] as entry, index (entry.id)}
                      <div class="relative">
                        <div
                          onclick={() => selectEntry(entry)}
                          class="w-full text-left transition-standard cursor-pointer"
                          style="padding: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-1);"
                        >
                          <!-- Title and timestamp row -->
                          <div class="flex justify-between items-center">
                            <h4 class="truncate" style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); flex: 1; margin-right: var(--space-2);">
                              {capitalize(entry.title)}
                            </h4>
                            <span class="flex-shrink-0" style="font-size: var(--text-xs); color: var(--text-secondary); font-weight: var(--font-medium);">
                              {formatEntryDate(entry)}
                            </span>
                          </div>
                          
                          <!-- Content row -->
                          <p class="truncate" style="font-size: var(--text-sm); color: var(--text-secondary);">
                            {entry.content}
                          </p>
                        </div>
                        
                        <!-- Three dots menu button positioned absolutely -->
                        <div class="absolute bottom-2 right-0 entry-menu-container z-10">
                          <button
                            onclick={(e) => toggleEntryMenu(entry.id, e)}
                            class="p-1 rounded-md hover:bg-opacity-20 transition-colors flex-shrink-0"
                            style="color: var(--text-tertiary); background: transparent;"
                            title="Entry options"
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
                            </svg>
                          </button>
                          
                          {#if activeMenuEntryId === entry.id}
                            <div class="absolute right-0 top-full mt-1 w-40 rounded-lg z-[60]" style="background: var(--background-primary); border: 1px solid var(--border-light); box-shadow: 0 4px 12px var(--shadow-hover);">
                              <div class="py-1">
                                <button
                                  onclick={(e) => { e.stopPropagation(); openMoveToModalFromTag(entry.id); }}
                                  class="w-full text-left px-3 py-2 transition-colors flex items-center gap-2"
                                  style="color: var(--text-primary); font-size: var(--text-sm);"
                                  onmouseenter={(e) => (e.target as HTMLElement).style.background = 'var(--background-tertiary)'}
                                  onmouseleave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  Move to
                                </button>
                                <button
                                  onclick={(e) => { e.stopPropagation(); deleteEntryFromTag(entry.id!); }}
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
                        
                        <!-- Divider line (except for last entry) -->
                        {#if index < tagEntries[tag.name].length - 1}
                          <div style="border-bottom: 1px solid var(--border-light);"></div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="text-center" style="padding: var(--space-4) 0;">
                    <p style="font-size: var(--text-sm); color: var(--text-secondary);">No entries found</p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .tag-section {
    transition: var(--transition-standard);
  }
  
  .tag-section:hover {
    transform: translateY(-1px);
  }
</style>

<!-- Move To Modal -->
{#if showMoveToModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={closeMoveToModalFromTag}>
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
                    onchange={() => toggleMoveToTagFromTag(tag.name)}
                    class="w-4 h-4 rounded"
                    style="color: var(--accent-blue);"
                  />
                                  <span class="flex-1" style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">{capitalize(tag.name)}</span>
                  <span style="font-size: var(--text-xs); color: var(--text-secondary);">{tag.usageCount}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex justify-end gap-3">
          <button
            onclick={closeMoveToModalFromTag}
            class="px-4 py-2 rounded-lg transition-colors"
            style="color: var(--text-secondary); background: var(--background-tertiary);"
          >
            Cancel
          </button>
          <button
            onclick={saveMoveToTagsFromTag}
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