<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import { tags, tagStore } from '../stores/tags.js';
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
    lastMonthToday: 0,
    lastYearToday: 0,
    topTags: [] as Array<{ name: string; count: number }>
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
    const currentDate = now.getDate();
    
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

    // Same date last month and last year
    stats.lastMonthToday = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return entryDate.getFullYear() === lastMonthYear && 
             entryDate.getMonth() === lastMonth && 
             entryDate.getDate() === currentDate;
    }).length;

    stats.lastYearToday = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.getFullYear() === currentYear - 1 && 
             entryDate.getMonth() === currentMonth && 
             entryDate.getDate() === currentDate;
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
        count
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
      showFilteredEntries('all', '', 'All', 'month-year');
    }
  }

  function handleTotalTagsClick() {
    if (showTags) {
      showTags();
    }
  }

  function handleCurrentMonthClick() {
    if (showFilteredEntries) {
      showFilteredEntries('month', 'current', `${getMonthName()}`, 'day-date');
    }
  }

  function handleCurrentYearClick() {
    if (showFilteredEntries) {
      showFilteredEntries('year', 'current', `${getYearName()}`, 'month');
    }
  }

  function handleTagClick(tagName: string) {
    if (showFilteredEntries) {
      showFilteredEntries('tag', tagName.toLowerCase(), `${capitalize(tagName)}`, 'month-year');
    }
  }

  function handleLastMonthTodayClick() {
    if (showFilteredEntries) {
      const now = new Date();
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const lastMonthDate = new Date(lastMonthYear, lastMonth, now.getDate());
      showFilteredEntries('date', lastMonthDate.toISOString().split('T')[0], `${lastMonthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 'none');
    }
  }

  function handleLastYearTodayClick() {
    if (showFilteredEntries) {
      const now = new Date();
      const lastYearDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      showFilteredEntries('date', lastYearDate.toISOString().split('T')[0], `${lastYearDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 'none');
    }
  }
</script>

<div class="h-full overflow-y-auto flex items-center justify-center" style="background: var(--background-primary); padding: var(--space-8) var(--space-6);">
  <div class="max-w-2xl text-center" style="line-height: 1.8; font-family: var(--font-primary);">
    <div style="margin-bottom: var(--space-8);">
      <h1 style="color: var(--text-primary); font-size: var(--text-xl); font-weight: var(--font-medium); margin-bottom: var(--space-8);">
        Hi, it's {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.<br>
        How are you doing?
      </h1>
    </div>
    
    <div style="text-align: center; margin: var(--space-8) 0;">
      <div style="height: 1px; background: var(--border-light); margin: 0 auto; width: 60px;"></div>
    </div>
    
{#if stats.lastMonthToday > 0 || stats.lastYearToday > 0}
    
    <div style="margin-bottom: var(--space-8);">
      {#if stats.lastMonthToday > 0}
        <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
          Last month today you wrote <button onclick={handleLastMonthTodayClick} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{stats.lastMonthToday} entries</button>.
        </p>
      {/if}
      {#if stats.lastYearToday > 0}
        <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
          Last year today you wrote <button onclick={handleLastYearTodayClick} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{stats.lastYearToday} entries</button>.
        </p>
      {/if}
    </div>
    
    <div style="text-align: center; margin: var(--space-8) 0;">
      <div style="height: 1px; background: var(--border-light); margin: 0 auto; width: 60px;"></div>
    </div>
{/if}
    
    <div style="margin-bottom: var(--space-8);">
      <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
        This month, you've captured <button onclick={handleCurrentMonthClick} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{stats.currentMonth} entries</button> of your journey{#if stats.lastMonth > 0}, {Math.abs(Math.round(((stats.currentMonth - stats.lastMonth) / stats.lastMonth) * 100))}% {stats.currentMonth > stats.lastMonth ? 'more' : stats.currentMonth < stats.lastMonth ? 'less' : 'the same'} than last month{:else if stats.lastMonth === 0 && stats.currentMonth > 0}, your first entries this period{/if}.
      </p>
      <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
        This year, you've penned <button onclick={handleCurrentYearClick} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{stats.currentYear} reflections</button> of your life{#if stats.lastYear > 0}, {Math.abs(Math.round(((stats.currentYear - stats.lastYear) / stats.lastYear) * 100))}% {stats.currentYear > stats.lastYear ? 'more' : stats.currentYear < stats.lastYear ? 'less' : 'the same'} than last year{:else if stats.lastYear === 0 && stats.currentYear > 0}, your first entries this year{/if}.
      </p>
    </div>
    
    <div style="text-align: center; margin: var(--space-8) 0;">
      <div style="height: 1px; background: var(--border-light); margin: 0 auto; width: 60px;"></div>
    </div>
    
    <div style="margin-bottom: var(--space-8);">
      <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
        Your journal holds <button onclick={handleTotalEntriesClick} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{stats.totalEntries} stories</button> across <button onclick={handleTotalTagsClick} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{stats.totalTags} themes</button> of your life.
      </p>
    </div>
    
    <div style="text-align: center; margin: var(--space-8) 0;">
      <div style="height: 1px; background: var(--border-light); margin: 0 auto; width: 60px;"></div>
    </div>


    {#if stats.topTags.length > 0}
      <div style="margin-bottom: var(--space-6);">
        <p style="color: var(--text-secondary);">
          {#each stats.topTags as tag, index}
            <button onclick={() => handleTagClick(tag.name)} class="underline hover:no-underline transition-all" style="color: var(--text-secondary); cursor: pointer;">{capitalize(tag.name)}</button> · {tag.count} {tag.count === 1 ? 'entry' : 'entries'}{#if index < stats.topTags.length - 1}<span style="margin: 0 var(--space-4);">|</span>{/if}
          {/each}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
</style>
