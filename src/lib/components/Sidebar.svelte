<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tagStore, tags } from '../stores/tags.js';
  import { groupEntriesByMonth, formatLastEditedTime } from '../utils/date.js';
  import { capitalize } from '../utils/text.js';
  import type { JournalEntry } from '../database/db.js';

  export let onSelectEntry: ((entry: JournalEntry) => void) | undefined = undefined;
  export let selectedEntryId: number | null = null;

  let selectedTagFilters: string[] = [];
  let showTagDropdown = false;
  let filteredEntries: JournalEntry[] = [];
  let activeMenuEntryId: number | null = null;
  let showMoveToModal = false;
  let moveToEntryId: number | null = null;
  let selectedMoveTags: string[] = [];

  onMount(() => {
    entryStore.loadAll();
    tagStore.loadAll();
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  $: {
    filteredEntries = filterEntriesByTags($entries, selectedTagFilters);
  }
  
  $: groupedEntries = groupEntriesByMonth(filteredEntries);
  $: monthKeys = Object.keys(groupedEntries).sort((a, b) => {
    const dateA = new Date(a + ' 1');
    const dateB = new Date(b + ' 1');
    return dateB.getTime() - dateA.getTime();
  });

  function selectEntry(entry: JournalEntry) {
    if (onSelectEntry) {
      onSelectEntry(entry);
    }
  }


  function filterEntriesByTags(entries: JournalEntry[], tagFilters: string[]): JournalEntry[] {
    if (tagFilters.length === 0) {
      return entries;
    }
    return entries.filter(entry => 
      entry.tags && tagFilters.some(filter => entry.tags.includes(filter))
    );
  }

  function toggleTagFilter(tagName: string) {
    if (selectedTagFilters.includes(tagName)) {
      selectedTagFilters = selectedTagFilters.filter(t => t !== tagName);
    } else {
      selectedTagFilters = [...selectedTagFilters, tagName];
    }
  }

  function clearAllFilters() {
    selectedTagFilters = [];
  }

  function toggleDropdown() {
    showTagDropdown = !showTagDropdown;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.tag-filter-container')) {
      showTagDropdown = false;
    }
    if (!target.closest('.entry-menu-container')) {
      activeMenuEntryId = null;
    }
  }

  function toggleEntryMenu(entryId: number, event: MouseEvent) {
    event.stopPropagation();
    activeMenuEntryId = activeMenuEntryId === entryId ? null : entryId;
  }

  async function deleteEntry(entryId: number) {
    const confirmDelete = confirm('Are you sure you want to delete this entry?\n\nThis action cannot be undone.');
    
    if (!confirmDelete) {
      return;
    }

    try {
      await entryStore.delete(entryId);
      await entryStore.loadAll();
      activeMenuEntryId = null;
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  }

  function openMoveToModal(entryId: number) {
    moveToEntryId = entryId;
    const entry = $entries.find(e => e.id === entryId);
    selectedMoveTags = entry?.tags ? [...entry.tags] : [];
    showMoveToModal = true;
    activeMenuEntryId = null;
  }

  function closeMoveToModal() {
    showMoveToModal = false;
    moveToEntryId = null;
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
      closeMoveToModal();
    } catch (error) {
      console.error('Error updating entry tags:', error);
      alert('Failed to update entry tags');
    }
  }
</script>

<div class="sidebar h-full overflow-y-auto">
  
  <!-- Tag Filter Dropdown -->
  <div style="padding: var(--space-4); border-bottom: 1px solid var(--border-light); background: var(--background-primary); height: 64px; display: flex; align-items: center;">
    <div class="relative tag-filter-container w-full">
      <div>
        <button
          onclick={toggleDropdown}
          class="w-full flex items-center justify-between transition-fast"
          style="padding: var(--space-2) var(--space-3); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--background-primary); color: var(--text-primary); height: 40px;"
        >
          <span class="text-left" style="color: var(--text-secondary);">
            {#if selectedTagFilters.length === 0}
              All entries
            {:else if selectedTagFilters.length === 1}
              {selectedTagFilters[0]}
            {:else}
              {selectedTagFilters.length} tags selected
            {/if}
          </span>
          <svg class="w-4 h-4 transition-transform" style="color: var(--text-tertiary);" class:rotate-180={showTagDropdown} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {#if showTagDropdown}
        <div class="absolute z-20 mt-2 w-full rounded-xl max-h-56 overflow-y-auto" style="background: var(--background-primary); border: 1px solid var(--border-light); box-shadow: 0 4px 12px var(--shadow-hover);">
          <div style="padding: var(--space-3); border-bottom: 1px solid var(--border-light);">
            <button
              onclick={clearAllFilters}
              class="w-full text-left transition-fast"
              style="padding: var(--space-3) var(--space-3); font-size: var(--text-sm); color: var(--accent-blue); border-radius: var(--radius-md);"
            >
              Clear all filters
            </button>
          </div>
          
          <div style="padding: var(--space-1);">
            {#each $tags.sort((a, b) => b.usageCount - a.usageCount) as tag}
              <label class="flex items-center cursor-pointer transition-fast" style="gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);">
                <input
                  type="checkbox"
                  checked={selectedTagFilters.includes(tag.name)}
                  onchange={() => toggleTagFilter(tag.name)}
                  class="w-4 h-4 rounded"
                  style="color: var(--accent-blue);"
                />
                <span class="flex-1" style="font-size: var(--text-sm); color: var(--text-primary);">{tag.name}</span>
                <span style="font-size: var(--text-xs); color: var(--text-secondary);">{tag.usageCount}</span>
              </label>
            {/each}
            
            {#if $tags.length === 0}
              <div class="text-center" style="padding: var(--space-3) var(--space-6);">
                <p style="font-size: var(--text-sm); color: var(--text-secondary);">No tags yet</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div>
    {#if monthKeys.length === 0}
      <div class="text-center" style="padding: var(--space-16) var(--space-4);">
        <div class="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style="background: var(--background-tertiary);">
          <svg class="w-6 h-6" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        {#if selectedTagFilters.length === 0}
          <p style="color: var(--text-secondary); font-size: var(--text-sm);">No entries yet</p>
          <p style="color: var(--text-tertiary); font-size: var(--text-xs); margin-top: var(--space-1);">Start writing to see your entries here</p>
        {:else}
          <p style="color: var(--text-secondary); font-size: var(--text-sm);">No entries with selected tags</p>
          <p style="color: var(--text-tertiary); font-size: var(--text-xs); margin-top: var(--space-1);">Try adjusting your filters</p>
        {/if}
      </div>
    {/if}
    
    {#each monthKeys as monthYear}
      <div style="margin-bottom: var(--space-6);">
        <!-- Month/Year Divider -->
        <div style="background: var(--background-tertiary); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-3); position: sticky; top: 0; z-index: 10;">
          <h3 style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
            {monthYear}
          </h3>
        </div>
        
        <!-- Entries for this month -->
        <div style="padding: 0 var(--space-4);">
          {#each groupedEntries[monthYear] as entry, index (entry.id)}
            <div class="relative">
              <div
                onclick={() => selectEntry(entry)}
                class="w-full text-left transition-standard cursor-pointer"
                class:active={selectedEntryId === entry.id}
                style="padding: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-1);"
              >
                <!-- Title and timestamp row -->
                <div class="flex justify-between items-center">
                  <h4 class="truncate" style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); flex: 1; margin-right: var(--space-2);">
                    {capitalize(entry.title)}
                  </h4>
                  <span class="flex-shrink-0" style="font-size: var(--text-xs); color: var(--text-secondary); font-weight: var(--font-medium);">
                    {formatLastEditedTime(new Date(entry.lastEditedAt || entry.timestamp))}
                  </span>
                </div>
                
                <!-- Content row -->
                <p class="truncate" style="font-size: var(--text-sm); color: var(--text-secondary);">
                  {entry.content}
                </p>
                
                <!-- Tags row -->
                {#if entry.tags && entry.tags.length > 0}
                  <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
                    {entry.tags.map(tag => capitalize(tag)).join(' | ')}
                  </span>
                {/if}
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
                  <div class="absolute right-0 top-full mt-1 w-40 rounded-lg z-20" style="background: var(--background-primary); border: 1px solid var(--border-light); box-shadow: 0 4px 12px var(--shadow-hover);">
                    <div class="py-1">
                      <button
                        onclick={(e) => { e.stopPropagation(); openMoveToModal(entry.id); }}
                        class="w-full text-left px-3 py-2 hover:bg-opacity-50 transition-colors flex items-center gap-2"
                        style="color: var(--text-primary); font-size: var(--text-sm);"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Move to
                      </button>
                      <button
                        onclick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
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
              {#if index < groupedEntries[monthYear].length - 1}
                <div style="border-bottom: 1px solid var(--border-light);"></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- Move To Modal -->
{#if showMoveToModal}
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

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>