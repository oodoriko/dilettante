<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tags, tagStore } from '../stores/tags.js';
  import { getTagColor } from '../utils/tagColors.js';
  import { capitalize } from '../utils/text.js';
  import { formatLastEditedTime } from '../utils/date.js';
  import type { JournalEntry } from '../database/db.js';

  export let onSelectEntry: ((entry: JournalEntry) => void) | undefined = undefined;
  export let filterType: 'all' | 'tags' | 'month' | 'year' | 'tag' = 'all';
  export let filterValue: string = '';
  export let filterTitle: string = 'All Entries';
  export let groupingType: 'month-year' | 'day-date' | 'month' | 'none' = 'none';

  let filteredEntries: JournalEntry[] = [];
  let groupedEntries: { [key: string]: JournalEntry[] } = {};
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

  $: if ($entries.length) {
    applyFilter();
    groupEntries();
  }

  function applyFilter() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (filterType) {
      case 'all':
        filteredEntries = [...$entries];
        break;
      
      case 'tags':
        filteredEntries = $entries.filter(entry => entry.tags && entry.tags.length > 0);
        break;
      
      case 'month':
        if (filterValue === 'current') {
          filteredEntries = $entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
          });
        } else if (filterValue === 'last') {
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          filteredEntries = $entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate.getFullYear() === lastMonthYear && entryDate.getMonth() === lastMonth;
          });
        }
        break;
      
      case 'year':
        if (filterValue === 'current') {
          filteredEntries = $entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate.getFullYear() === currentYear;
          });
        } else if (filterValue === 'last') {
          filteredEntries = $entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate.getFullYear() === currentYear - 1;
          });
        }
        break;
      
      case 'tag':
        filteredEntries = $entries.filter(entry => 
          entry.tags && entry.tags.includes(filterValue.toLowerCase())
        );
        break;
      
      default:
        filteredEntries = [...$entries];
    }

    // Sort by last edited date (most recent first)
    filteredEntries.sort((a, b) => 
      new Date(b.lastEditedAt || b.timestamp).getTime() - 
      new Date(a.lastEditedAt || a.timestamp).getTime()
    );
  }

  function groupEntries() {
    if (groupingType === 'none') {
      groupedEntries = {};
      return;
    }

    groupedEntries = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.lastEditedAt || entry.timestamp);
      let groupKey = '';
      
      switch (groupingType) {
        case 'month-year':
          groupKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          break;
        case 'day-date':
          groupKey = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
          });
          break;
        case 'month':
          groupKey = date.toLocaleDateString('en-US', { month: 'long' });
          break;
      }
      
      if (!groupedEntries[groupKey]) {
        groupedEntries[groupKey] = [];
      }
      groupedEntries[groupKey].push(entry);
    });

    // Sort group keys by date
    const sortedKeys = Object.keys(groupedEntries).sort((a, b) => {
      const entryA = groupedEntries[a][0];
      const entryB = groupedEntries[b][0];
      return new Date(entryB.lastEditedAt || entryB.timestamp).getTime() - 
             new Date(entryA.lastEditedAt || entryA.timestamp).getTime();
    });

    const sortedGroupedEntries: { [key: string]: JournalEntry[] } = {};
    sortedKeys.forEach(key => {
      sortedGroupedEntries[key] = groupedEntries[key];
    });
    groupedEntries = sortedGroupedEntries;
  }

  function selectEntry(entry: JournalEntry) {
    if (onSelectEntry) {
      onSelectEntry(entry);
    }
  }

  function formatEntryDate(entry: JournalEntry): string {
    const date = new Date(entry.lastEditedAt || entry.timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  }

  function getEntryPreview(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
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

<div class="h-full overflow-y-auto p-8" style="background: var(--background-secondary);">
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8 text-center" style="padding: var(--space-3) var(--space-4);">
      <h1 style="color: var(--text-secondary); font-size: var(--text-lg); margin: 0;">
        {filterTitle}
      </h1>
      <p style="color: var(--text-tertiary); font-size: var(--text-sm); margin-top: var(--space-1);">
        {filteredEntries.length}
      </p>
    </div>

    <!-- Entries List -->
    <div class="space-y-4">
      {#if filteredEntries.length === 0}
        <div class="text-center py-16">
          <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style="background: var(--background-tertiary);">
            <svg class="w-8 h-8" style="color: var(--text-secondary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 style="font-size: var(--text-xl); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-3);">No entries found</h3>
          <p style="color: var(--text-secondary);">No entries match the selected criteria</p>
        </div>
      {:else if groupingType === 'none'}
        <!-- No grouping - show flat list -->
        <div class="space-y-4">
          {#each filteredEntries as entry (entry.id)}
          <div class="relative entry-card-container">
            <div
              onclick={() => selectEntry(entry)}
              class="w-full text-left p-6 rounded-xl hover:shadow-md transition-all duration-200 hover:scale-[1.01] cursor-pointer"
              style="background: var(--background-primary); border: 1px solid var(--border-light);"
            >
              <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-semibold truncate pr-4" style="color: var(--text-primary);">
                  {capitalize(entry.title)}
                </h3>
                <span class="flex-shrink-0 text-sm" style="color: var(--text-tertiary);">
                  {formatEntryDate(entry)}
                </span>
              </div>
              
              <p class="text-sm mb-4 leading-relaxed" style="color: var(--text-secondary);">
                {getEntryPreview(entry.content)}
              </p>
              
              {#if entry.tags && entry.tags.length > 0}
                <div class="flex flex-wrap gap-2">
                  {#each entry.tags.slice(0, 5) as tag}
                    <span 
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-white rounded-full"
                      style="background-color: {getTagColor(tag, $tags)}"
                    >
                      {capitalize(tag)}
                    </span>
                  {/each}
                  {#if entry.tags.length > 5}
                    <span class="text-xs px-2 py-1 rounded-full" style="background: var(--background-tertiary); color: var(--text-secondary);">
                      +{entry.tags.length - 5}
                    </span>
                  {/if}
                </div>
              {/if}
            </div>
            
            <!-- Three dots menu button positioned absolutely -->
            <div class="absolute bottom-4 right-4 entry-menu-container z-10">
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
          </div>
        {/each}
        </div>
      {:else}
        <!-- Grouped entries -->
        <div class="space-y-6">
          {#each Object.keys(groupedEntries) as groupKey}
            <div>
              <!-- Group Divider -->
              <div class="mb-4" style="padding: var(--space-3) var(--space-4); background: var(--background-tertiary); border-radius: var(--radius-lg);">
                <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0;">
                  {groupKey}
                </h3>
              </div>
              
              <!-- Entries in this group -->
              <div class="space-y-4">
                {#each groupedEntries[groupKey] as entry (entry.id)}
                  <div class="relative entry-card-container">
                    <div
                      onclick={() => selectEntry(entry)}
                      class="w-full text-left p-6 rounded-xl hover:shadow-md transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                      style="background: var(--background-primary); border: 1px solid var(--border-light);"
                    >
                      <div class="flex justify-between items-start mb-3">
                        <h3 class="text-lg font-semibold truncate pr-4" style="color: var(--text-primary);">
                          {capitalize(entry.title)}
                        </h3>
                        <span class="flex-shrink-0 text-sm" style="color: var(--text-tertiary);">
                          {formatEntryDate(entry)}
                        </span>
                      </div>
                      
                      <p class="text-sm mb-4 leading-relaxed" style="color: var(--text-secondary);">
                        {getEntryPreview(entry.content)}
                      </p>
                      
                      {#if entry.tags && entry.tags.length > 0}
                        <div class="flex flex-wrap gap-2">
                          {#each entry.tags.slice(0, 5) as tag}
                            <span 
                              class="inline-flex items-center px-2 py-1 text-xs font-medium text-white rounded-full"
                              style="background-color: {getTagColor(tag, $tags)}"
                            >
                              {capitalize(tag)}
                            </span>
                          {/each}
                          {#if entry.tags.length > 5}
                            <span class="text-xs px-2 py-1 rounded-full" style="background: var(--background-tertiary); color: var(--text-secondary);">
                              +{entry.tags.length - 5}
                            </span>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    
                    <!-- Three dots menu button positioned absolutely -->
                    <div class="absolute bottom-4 right-4 entry-menu-container z-10">
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
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
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