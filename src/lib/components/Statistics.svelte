<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tags, tagStore } from '../stores/tags.js';
  import { getTagColor } from '../utils/tagColors.js';
  import { capitalize } from '../utils/text.js';
  import type { JournalEntry } from '../database/db.js';

  export let showFilteredEntries: ((type: 'all' | 'tags' | 'month' | 'year' | 'tag', value?: string, title?: string, grouping?: 'month-year' | 'day-date' | 'month' | 'none') => void) | undefined = undefined;
  export let showTags: (() => void) | undefined = undefined;

  let dashboardTitle = 'Journal Statistics';
  let isEditingTitle = false;
  let titleInput: HTMLInputElement;

  let stats = {
    totalEntries: 0,
    totalTags: 0,
    currentMonth: 0,
    lastMonth: 0,
    currentYear: 0,
    lastYear: 0,
    topTags: [] as Array<{ name: string; count: number; color: string }>
  };

  onMount(() => {
    entryStore.loadAll();
    tagStore.loadAll();
    loadDashboardTitle();
  });

  function loadDashboardTitle() {
    const saved = localStorage.getItem('dashboardTitle');
    if (saved) {
      dashboardTitle = saved;
    }
  }

  function saveDashboardTitle() {
    localStorage.setItem('dashboardTitle', dashboardTitle);
    isEditingTitle = false;
  }

  function startEditingTitle() {
    isEditingTitle = true;
    setTimeout(() => {
      titleInput?.focus();
      titleInput?.select();
    }, 0);
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      saveDashboardTitle();
    } else if (event.key === 'Escape') {
      isEditingTitle = false;
      loadDashboardTitle(); // Reset to saved value
    }
  }

  $: if ($entries.length || $tags.length) {
    calculateStats($entries, $tags);
  }

  function calculateStats(allEntries: JournalEntry[], allTags: any[]) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Basic counts
    stats.totalEntries = allEntries.length;
    stats.totalTags = allTags.length;

    // Time-based entry counts
    stats.currentMonth = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
    }).length;

    stats.lastMonth = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return entryDate.getFullYear() === lastMonthYear && entryDate.getMonth() === lastMonth;
    }).length;

    stats.currentYear = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.getFullYear() === currentYear;
    }).length;

    stats.lastYear = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.getFullYear() === currentYear - 1;
    }).length;

    // Top tags calculation
    const tagUsage = new Map<string, number>();
    allEntries.forEach(entry => {
      if (entry.tags) {
        entry.tags.forEach(tag => {
          tagUsage.set(tag, (tagUsage.get(tag) || 0) + 1);
        });
      }
    });

    stats.topTags = Array.from(tagUsage.entries())
      .map(([name, count]) => ({
        name,
        count,
        color: getTagColor(name, allTags)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  function getMonthName(monthOffset: number = 0): string {
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return targetMonth.toLocaleDateString('en-US', { month: 'long' });
  }

  function getYearName(yearOffset: number = 0): string {
    const now = new Date();
    return (now.getFullYear() + yearOffset).toString();
  }

  function handleTotalEntriesClick() {
    if (showFilteredEntries) {
      showFilteredEntries('all', '', 'All Entries', 'month-year');
    }
  }

  function handleTotalTagsClick() {
    if (showTags) {
      showTags();
    }
  }

  function handleCurrentMonthClick() {
    if (showFilteredEntries) {
      showFilteredEntries('month', 'current', `${getMonthName()} Entries`, 'day-date');
    }
  }

  function handleCurrentYearClick() {
    if (showFilteredEntries) {
      showFilteredEntries('year', 'current', `${getYearName()} Entries`, 'month');
    }
  }

  function handleTagClick(tagName: string) {
    if (showFilteredEntries) {
      showFilteredEntries('tag', tagName.toLowerCase(), `${capitalize(tagName)} Entries`, 'month-year');
    }
  }
</script>

<div class="h-full overflow-y-auto p-8" style="background: var(--background-secondary);">
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8 text-center" style="padding: var(--space-3) var(--space-4);">
      {#if isEditingTitle}
        <input
          bind:this={titleInput}
          bind:value={dashboardTitle}
          onkeydown={handleTitleKeydown}
          onblur={saveDashboardTitle}
          class="bg-transparent border-none outline-none text-center"
          style="color: var(--text-secondary); font-size: var(--text-lg); width: 100%; max-width: 400px;"
          maxlength="50"
        />
      {:else}
        <h1 
          onclick={startEditingTitle}
          class="cursor-pointer hover:opacity-75 transition-opacity"
          style="color: var(--text-secondary); font-size: var(--text-lg); margin: 0;"
        >
          {dashboardTitle}
        </h1>
      {/if}
    </div>
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Total Entries -->
      <button class="stat-card text-left" onclick={handleTotalEntriesClick}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: var(--accent-blue-light);">
            <svg class="w-6 h-6" style="color: var(--accent-blue);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-1);">
          {stats.totalEntries}
        </div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary);">
          Total Entries
        </div>
      </button>

      <!-- Total Tags -->
      <button class="stat-card text-left" onclick={handleTotalTagsClick}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: var(--accent-green-light);">
            <svg class="w-6 h-6" style="color: var(--accent-green);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
        </div>
        <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-1);">
          {stats.totalTags}
        </div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary);">
          Total Tags
        </div>
      </button>

      <!-- Current Month -->
      <button class="stat-card text-left" onclick={handleCurrentMonthClick}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: var(--accent-purple-light);">
            <svg class="w-6 h-6" style="color: var(--accent-purple);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-1);">
          {stats.currentMonth}
        </div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary);">
          This {getMonthName()}
        </div>
      </button>

      <!-- Current Year -->
      <button class="stat-card text-left" onclick={handleCurrentYearClick}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: var(--accent-orange-light);">
            <svg class="w-6 h-6" style="color: var(--accent-orange);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2H9.1z" />
            </svg>
          </div>
        </div>
        <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-1);">
          {stats.currentYear}
        </div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary);">
          This Year ({getYearName()})
        </div>
      </button>
    </div>

    <!-- Comparison Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- Monthly Comparison -->
      <div class="stat-card">
        <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-4);">
          Monthly Activity
        </h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span style="color: var(--text-secondary);">{getMonthName()}</span>
            <div class="flex items-center gap-2">
              <div class="h-2 rounded-full" style="width: {Math.max((stats.currentMonth / Math.max(stats.currentMonth, stats.lastMonth, 1)) * 100, 5)}%; background: var(--accent-blue);"></div>
              <span style="font-weight: var(--font-semibold); color: var(--text-primary); min-width: 2rem;">{stats.currentMonth}</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span style="color: var(--text-secondary);">{getMonthName(-1)}</span>
            <div class="flex items-center gap-2">
              <div class="h-2 rounded-full" style="width: {Math.max((stats.lastMonth / Math.max(stats.currentMonth, stats.lastMonth, 1)) * 100, 5)}%; background: var(--background-tertiary);"></div>
              <span style="font-weight: var(--font-semibold); color: var(--text-primary); min-width: 2rem;">{stats.lastMonth}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Yearly Comparison -->
      <div class="stat-card">
        <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-4);">
          Yearly Activity
        </h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span style="color: var(--text-secondary);">{getYearName()}</span>
            <div class="flex items-center gap-2">
              <div class="h-2 rounded-full" style="width: {Math.max((stats.currentYear / Math.max(stats.currentYear, stats.lastYear, 1)) * 100, 5)}%; background: var(--accent-green);"></div>
              <span style="font-weight: var(--font-semibold); color: var(--text-primary); min-width: 2rem;">{stats.currentYear}</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span style="color: var(--text-secondary);">{getYearName(-1)}</span>
            <div class="flex items-center gap-2">
              <div class="h-2 rounded-full" style="width: {Math.max((stats.lastYear / Math.max(stats.currentYear, stats.lastYear, 1)) * 100, 5)}%; background: var(--background-tertiary);"></div>
              <span style="font-weight: var(--font-semibold); color: var(--text-primary); min-width: 2rem;">{stats.lastYear}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Tags -->
    {#if stats.topTags.length > 0}
      <div class="stat-card">
        <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-4);">
          Most Used Tags
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          {#each stats.topTags as tag}
            <button 
              class="flex items-center justify-between p-3 rounded-lg hover:shadow-md transition-all duration-200 hover:scale-[1.02] text-left w-full" 
              style="background: var(--background-primary); border: 1px solid var(--border-light);"
              onclick={() => handleTagClick(tag.name)}
            >
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full" style="background-color: {tag.color}"></span>
                <span style="font-weight: var(--font-medium); color: var(--text-primary);">
                  {capitalize(tag.name)}
                </span>
              </div>
              <span class="text-xs font-medium px-2 py-1 rounded-full" style="background: var(--background-tertiary); color: var(--text-secondary);">
                {tag.count}
              </span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .stat-card {
    background: var(--background-primary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    box-shadow: 0 1px 3px var(--shadow-subtle);
    transition: var(--transition-standard);
    cursor: pointer;
    width: 100%;
  }

  .stat-card:hover {
    box-shadow: 0 4px 12px var(--shadow-hover);
    transform: translateY(-2px);
  }

  .stat-card:active {
    transform: translateY(0);
  }
</style>