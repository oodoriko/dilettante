<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tagStore, tags } from '../stores/tags.js';
  import { getEntryColor } from '../utils/tagColors.js';
  import { capitalize } from '../utils/text.js';
  import type { JournalEntry } from '../database/db.js';

  export let onSelectEntry: ((entry: JournalEntry) => void) | undefined = undefined;

  let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let calendarDays: (Date | null)[] = [];
  let entriesByDate: { [key: string]: JournalEntry[] } = {};
  let selectedTagFilters: string[] = [];
  let filteredEntries: JournalEntry[] = [];
  let showTagDropdown = false;
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
    groupEntriesByDate(filteredEntries);
  }
  
  $: currentMonth, generateCalendar();

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

  function generateCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    calendarDays = [];
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      calendarDays.push(currentDate);
    }
  }

  function groupEntriesByDate(entries: JournalEntry[]) {
    entriesByDate = {};
    entries.forEach(entry => {
      const dateKey = new Date(entry.timestamp).toDateString();
      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = [];
      }
      entriesByDate[dateKey].push(entry);
    });
  }

  function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  }

  function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  function goToCurrentMonth() {
    const now = new Date();
    currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function selectEntry(entry: JournalEntry) {
    if (onSelectEntry) {
      onSelectEntry(entry);
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

  function isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
  }

  function getEntriesForDate(date: Date): JournalEntry[] {
    return entriesByDate[date.toDateString()] || [];
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="h-full p-8 bg-neutral-25 overflow-y-auto">
  <div class="max-w-6xl mx-auto">
    <!-- Calendar Header -->
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-3xl font-bold text-neutral-900">
        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
      </h2>
      
      <div class="flex gap-4 items-center">
        <!-- Tag Filter Dropdown -->
        <div class="relative tag-filter-container" style="min-width: 200px;">
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
              
              <div style="padding: var(--space-2);">
                {#each $tags.sort((a, b) => b.usageCount - a.usageCount) as tag}
                  <label class="flex items-center cursor-pointer transition-fast" style="gap: var(--space-3); padding: var(--space-3) var(--space-3); border-radius: var(--radius-md);">
                    <input
                      type="checkbox"
                      checked={selectedTagFilters.includes(tag.name)}
                      onchange={() => toggleTagFilter(tag.name)}
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
                
                {#if $tags.length === 0}
                  <div class="text-center" style="padding: var(--space-3) var(--space-6);">
                    <p style="font-size: var(--text-sm); color: var(--text-secondary);">No tags yet</p>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
        
        <div class="flex gap-1 items-center">
        <button
          onclick={previousMonth}
          class="btn-ghost"
          title="Previous Month"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onclick={goToCurrentMonth}
          class="w-2 h-2 bg-neutral-400 hover:bg-primary-500 rounded-full transition-all duration-200 hover:scale-125"
          title="Go to Current Month"
        >
        </button>
        <button
          onclick={nextMonth}  
          class="btn-ghost"
          title="Next Month"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        </div>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="bg-white rounded-2xl shadow-card border border-neutral-200 overflow-hidden">
      <!-- Day Headers -->
      <div class="grid grid-cols-7 bg-neutral-50">
        {#each dayNames as dayName}
          <div class="p-4 text-center text-sm font-semibold text-neutral-700 border-r border-neutral-200 last:border-r-0">
            {dayName}
          </div>
        {/each}
      </div>

      <!-- Calendar Days -->
      <div class="grid grid-cols-7">
        {#each calendarDays as date, index}
          <div class="min-h-36 border-r border-b border-neutral-200 last:border-r-0 {index >= 35 ? 'last:border-b-0' : ''} hover:bg-neutral-25 transition-colors">
            <div class="h-full p-3 flex flex-col">
              <!-- Day Number -->
              <div class="flex justify-between items-start mb-3">
                <span 
                  class="text-sm font-semibold {isCurrentMonth(date) ? 'text-neutral-900' : 'text-neutral-400'} 
                         {isToday(date) ? 'bg-neutral-900 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm' : ''}"
                >
                  {date.getDate()}
                </span>
              </div>

              <!-- Entries for this date -->
              <div class="flex-1 space-y-1">
                {#each getEntriesForDate(date).slice(0, 3) as entry}
                  <div class="relative entry-card-container group">
                    <div
                      onclick={() => selectEntry(entry)}
                      class="w-full text-left pr-6 pl-2 py-1 text-white rounded border-0 hover:shadow-sm transition-all duration-200 hover:scale-105 cursor-pointer"
                      style="background-color: {getEntryColor(entry.tags || [], $tags)}; font-size: 10px; line-height: 1.2;"
                      title="{entry.title}{entry.tags && entry.tags.length > 0 ? ' • Tags: ' + entry.tags.join(', ') : ''}"
                    >
                      <div class="truncate font-medium">{capitalize(entry.title)}</div>
                    </div>
                    
                    <!-- Three dots menu button - only visible on hover -->
                    <div class="absolute top-1/2 right-1 transform -translate-y-1/2 entry-menu-container z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onclick={(e) => toggleEntryMenu(entry.id, e)}
                        class="w-4 h-4 rounded-sm hover:bg-black hover:bg-opacity-20 transition-colors flex-shrink-0 flex items-center justify-center text-xs"
                        style="color: white; background: rgba(0,0,0,0.3); font-family: monospace; letter-spacing: 0; margin: 0; padding: 0;"
                        title="Entry options"
                      >
                        <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                        </svg>
                      </button>
                      
                      {#if activeMenuEntryId === entry.id}
                        <div class="absolute right-0 top-full mt-1 w-32 rounded-lg z-20" style="background: var(--background-primary); border: 1px solid var(--border-light); box-shadow: 0 4px 12px var(--shadow-hover);">
                          <div class="py-1">
                            <button
                              onclick={(e) => { e.stopPropagation(); openMoveToModal(entry.id); }}
                              class="w-full text-left px-2 py-1 hover:bg-opacity-50 transition-colors flex items-center gap-1"
                              style="color: var(--text-primary); font-size: var(--text-xs);"
                            >
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              Move to
                            </button>
                            <button
                              onclick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                              class="w-full text-left px-2 py-1 hover:bg-red-50 transition-colors flex items-center gap-1"
                              style="color: var(--text-red); font-size: var(--text-xs);"
                            >
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                
                {#if getEntriesForDate(date).length > 3}
                  <div class="text-center rounded" style="font-size: var(--text-xs); color: var(--text-secondary); background: var(--background-tertiary); padding: var(--space-1) var(--space-2);">
                    +{getEntriesForDate(date).length - 3} more
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Entry Details -->
    {#if Object.keys(entriesByDate).length === 0}
      <div class="text-center mt-16">
        <div class="w-20 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-soft">
          <svg class="w-10 h-10 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        {#if selectedTagFilters.length === 0}
          <h3 class="text-xl font-semibold text-neutral-900 mb-3 text-balance">No entries yet</h3>
          <p class="text-neutral-600 text-lg leading-relaxed text-balance">Start writing your first journal entry to see it appear on the calendar</p>
        {:else}
          <h3 class="text-xl font-semibold text-neutral-900 mb-3 text-balance">No entries with selected tags</h3>
          <p class="text-neutral-600 text-lg leading-relaxed text-balance">Try selecting different tags or create new entries with these tags</p>
        {/if}
      </div>
    {/if}
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