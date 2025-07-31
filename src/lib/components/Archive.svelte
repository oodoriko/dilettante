<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tags, tagStore } from '../stores/tags.js';
  import { capitalize } from '../utils/text.js';
  import type { JournalEntry } from '../database/db.js';

  export let onSelectEntry: ((entry: JournalEntry) => void) | undefined = undefined;

  let filteredEntries: JournalEntry[] = [];
  let activeMenuEntryId: number | null = null;
  let showMoveToModal = false;
  let moveToEntryId: number | null = null;
  let selectedMoveTags: string[] = [];

  // Filter controls
  let startDate = '';
  let endDate = '';
  let selectedTag = '';
  let searchKeyword = '';
  let selectedYear = '';

  // Get unique years from entries
  let availableYears: number[] = [];

  onMount(() => {
    entryStore.loadAll();
    tagStore.loadAll();
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  $: if ($entries.length) {
    // Calculate available years
    const years = new Set<number>();
    $entries.forEach(entry => {
      const entryYear = new Date(entry.timestamp).getFullYear();
      years.add(entryYear);
    });
    availableYears = Array.from(years).sort((a, b) => b - a);
    
    applyFilters();
  }

  function applyFilters() {
    let filtered = [...$entries];

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(entry => new Date(entry.timestamp) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter(entry => new Date(entry.timestamp) <= end);
    }

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter(entry => 
        entry.tags && entry.tags.includes(selectedTag)
      );
    }

    // Filter by search keyword
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase().trim();
      filtered = filtered.filter(entry => 
        entry.title.toLowerCase().includes(keyword) || 
        entry.content.toLowerCase().includes(keyword) ||
        (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(keyword)))
      );
    }

    // Filter by year
    if (selectedYear) {
      const year = parseInt(selectedYear);
      filtered = filtered.filter(entry => 
        new Date(entry.timestamp).getFullYear() === year
      );
    }

    // Sort by last edited date (most recent first)
    filtered.sort((a, b) => 
      new Date(b.lastEditedAt || b.timestamp).getTime() - 
      new Date(a.lastEditedAt || a.timestamp).getTime()
    );

    filteredEntries = filtered;
  }

  function clearAllFilters() {
    startDate = '';
    endDate = '';
    selectedTag = '';
    searchKeyword = '';
    selectedYear = '';
    applyFilters();
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

<div class="h-full overflow-y-auto p-8" style="background: var(--background-primary); font-family: var(--font-primary);">
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <div class="mb-8 text-center" style="padding: var(--space-3) var(--space-4);">
      <h1 style="color: var(--text-primary); font-size: var(--text-xl); font-weight: var(--font-medium); margin: 0; line-height: 1.6;">
        Archive · {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
      </h1>
    </div>

    <!-- Filter Controls -->
    <div class="mb-8 space-y-4" style="background: var(--background-secondary); padding: var(--space-6); border-radius: var(--radius-lg);">
      <div class="flex justify-between items-center mb-4">
        <h3 style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0;">Filters</h3>
        <button
          onclick={clearAllFilters}
          style="font-size: var(--text-xs); color: var(--accent-blue); background: transparent; border: none; cursor: pointer;"
        >
          Clear all
        </button>
      </div>

      <!-- Date Range -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-2);">Start Date</label>
          <input
            type="date"
            bind:value={startDate}
            class="w-full"
            style="padding: var(--space-2); border: none; border-radius: var(--radius-md); background: var(--background-primary); color: var(--text-primary); font-size: var(--text-sm); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;"
          />
        </div>
        <div>
          <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-2);">End Date</label>
          <input
            type="date"
            bind:value={endDate}
            class="w-full"
            style="padding: var(--space-2); border: none; border-radius: var(--radius-md); background: var(--background-primary); color: var(--text-primary); font-size: var(--text-sm); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;"
          />
        </div>
      </div>

      <!-- Tag and Year Filters -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-2);">Filter by Tag</label>
          <select
            bind:value={selectedTag}
            class="w-full"
            style="padding: var(--space-2); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--background-primary); color: var(--text-primary); font-size: var(--text-sm);"
          >
            <option value="">All tags</option>
            {#each $tags.sort((a, b) => b.usageCount - a.usageCount) as tag}
              <option value={tag.name}>{capitalize(tag.name)}</option>
            {/each}
          </select>
        </div>
        <div>
          <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-2);">Filter by Year</label>
          <select
            bind:value={selectedYear}
            class="w-full"
            style="padding: var(--space-2); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--background-primary); color: var(--text-primary); font-size: var(--text-sm);"
          >
            <option value="">All years</option>
            {#each availableYears as year}
              <option value={year.toString()}>{year}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Search -->
      <div>
        <label style="font-size: var(--text-xs); color: var(--text-secondary); display: block; margin-bottom: var(--space-2);">Search</label>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={searchKeyword}
            placeholder="Search in titles, content, or tags..."
            class="flex-1"
            style="padding: var(--space-2); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--background-primary); color: var(--text-primary); font-size: var(--text-sm);"
            onkeydown={(e) => e.key === 'Enter' && applyFilters()}
          />
          <button
            onclick={applyFilters}
            class="px-4 py-2 rounded-md transition-colors"
            style="background: var(--accent-blue); color: white; border: none; font-size: var(--text-sm); font-weight: var(--font-medium);"
            title="Search"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>
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
          <p style="color: var(--text-secondary);">Try adjusting your filters or search criteria</p>
        </div>
      {:else}
        <div style="padding: 0 var(--space-4);">
          {#each filteredEntries as entry, index (entry.id)}
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
                  {getEntryPreview(entry.content)}
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
                  onclick={(e) => toggleEntryMenu(entry.id!, e)}
                  class="p-1 rounded-md hover:bg-opacity-20 transition-colors flex-shrink-0"
                  class:bg-opacity-10={activeMenuEntryId === entry.id}
                  style="color: var(--text-tertiary); background: {activeMenuEntryId === entry.id ? 'var(--background-tertiary)' : 'transparent'};"
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
                        onclick={(e) => { e.stopPropagation(); openMoveToModal(entry.id!); }}
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
                        onclick={(e) => { e.stopPropagation(); deleteEntry(entry.id!); }}
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
              {#if index < filteredEntries.length - 1}
                <div style="border-bottom: 1px solid var(--border-light);"></div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Move To Modal -->
{#if showMoveToModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onclick={closeMoveToModal}>
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
                  <span class="flex-1" style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">{capitalize(tag.name)}</span>
                  <span style="font-size: var(--text-xs); color: var(--text-secondary);">{tag.usageCount}</span>
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

