<script lang="ts">
  import Sidebar from '../lib/components/Sidebar.svelte';
  import EntryEditor from '../lib/components/EntryEditor.svelte';
  import Calendar from '../lib/components/Calendar.svelte';
  import Statistics from '../lib/components/Statistics.svelte';
  import TagManagement from '../lib/components/TagManagement.svelte';
  import FilteredEntries from '../lib/components/FilteredEntries.svelte';
  import Archive from '../lib/components/Archive.svelte';
  import type { JournalEntry } from '../lib/database/db.js';

  let currentView: 'statistics' | 'new' | 'edit' | 'calendar' | 'tags' | 'filtered' | 'archive' = 'statistics';
  let selectedEntry: JournalEntry | null = null;
  let filterConfig = {
    type: 'all' as 'all' | 'tags' | 'month' | 'year' | 'tag',
    value: '',
    title: 'All Entries',
    grouping: 'none' as 'month-year' | 'day-date' | 'month' | 'none'
  };

  function showNewEntry() {
    currentView = 'new';
    selectedEntry = null;
  }

  function showStatistics() {
    currentView = 'statistics';
    selectedEntry = null;
  }

  function showCalendar() {
    currentView = 'calendar';
    selectedEntry = null;
  }

  function showArchive() {
    currentView = 'archive';
    selectedEntry = null;
  }

  function showTags() {
    currentView = 'tags';
    selectedEntry = null;
  }

  function showFilteredEntries(type: 'all' | 'tags' | 'month' | 'year' | 'tag', value: string = '', title: string = 'Entries', grouping: 'month-year' | 'day-date' | 'month' | 'none' = 'none') {
    filterConfig = { type, value, title, grouping };
    currentView = 'filtered';
    selectedEntry = null;
  }

  function selectEntry(entry: JournalEntry) {
    selectedEntry = entry;
    currentView = 'edit';
  }
</script>

<div class="h-screen flex" style="background: var(--background-secondary);">
  <!-- Sidebar -->
  <div class="flex flex-col h-full">
    <Sidebar onSelectEntry={selectEntry} selectedEntryId={selectedEntry?.id} />
  </div>
  
  <!-- Main Content Area -->
  <div class="flex-1 flex flex-col">
    <!-- Header -->
    <header class="h-16 px-6" style="border-bottom: 1px solid var(--border-light); background: var(--background-primary);">
      <div class="flex justify-end items-center h-full">
        <div class="flex items-center gap-2">
          {#if currentView !== 'statistics'}
            <button
              onclick={showStatistics}
              class="btn-secondary"
              title="Back to Statistics"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          {/if}
          
          <button
            onclick={showCalendar}
            class="btn-secondary"
            title="Calendar View"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          
          <button
            onclick={showArchive}
            class="btn-secondary"
            title="Archive"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          
          <button
            onclick={showTags}
            class="btn-secondary"
            title="Manage Tags"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>
          
          <button
            onclick={showNewEntry}
            class="btn-primary"
            title="New Entry"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Content Area -->
    <main class="flex-1 overflow-hidden" style="background: var(--background-secondary);">
      {#if currentView === 'statistics'}
        <Statistics {showFilteredEntries} {showTags} />
      {:else if currentView === 'calendar'}
        <Calendar onSelectEntry={selectEntry} showFilteredEntries={showFilteredEntries} />
      {:else if currentView === 'archive'}
        <Archive onSelectEntry={selectEntry} />
      {:else if currentView === 'tags'}
        <TagManagement onSelectEntry={selectEntry} />
      {:else if currentView === 'filtered'}
        <FilteredEntries 
          onSelectEntry={selectEntry} 
          filterType={filterConfig.type}
          filterValue={filterConfig.value}
          filterTitle={filterConfig.title}
          groupingType={filterConfig.grouping}
        />
      {:else if currentView === 'new'}
        <EntryEditor onSave={showStatistics} />
      {:else if currentView === 'edit' && selectedEntry}
        <EntryEditor entry={selectedEntry} onSave={showStatistics} />
      {/if}
    </main>
  </div>
</div>
