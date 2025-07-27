<script lang="ts">
  import { onMount } from 'svelte';
  import { entries, entryStore } from '../stores/entries.js';
  import type { JournalEntry } from '../database/db.js';

  export let onSelectEntry: ((entry: JournalEntry) => void) | undefined = undefined;

  onMount(() => {
    entryStore.loadAll();
  });

  function selectEntry(entry: JournalEntry) {
    if (onSelectEntry) {
      onSelectEntry(entry);
    }
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function truncateContent(content: string, maxLength = 150) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
</script>

<div class="max-w-3xl mx-auto px-8 py-8">
  <div class="space-y-6">
    {#each $entries as entry (entry.id)}
      <article 
        style="background-color: #ffffff; border-radius: 1rem; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s; cursor: pointer; border: 1px solid #f4f4f5;"
        onclick={() => selectEntry(entry)}
        onkeydown={(e) => e.key === 'Enter' && selectEntry(entry)}
        role="button"
        tabindex="0"
      >
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h2 style="font-size: 1.25rem; font-weight: 600; color: #333333; line-height: 1.3;">
              {entry.title}
            </h2>
            <time style="font-size: 0.875rem; color: #71717a; font-weight: 500;">
              {formatDate(entry.timestamp)}
            </time>
          </div>
          
          <p style="color: #333333; line-height: 1.6; font-size: 1rem;">
            {truncateContent(entry.content)}
          </p>
          
          {#if entry.tags && entry.tags.length > 0}
            <div style="display: flex; gap: 0.5rem; padding-top: 0.5rem;">
              {#each entry.tags as tag}
                <span style="padding: 0.25rem 0.75rem; background-color: #f4f4f5; color: #52525b; font-size: 0.875rem; border-radius: 9999px; font-weight: 500;">
                  #{tag}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </article>
    {:else}
      <div style="text-align: center; padding: 6rem 0;">
        <p style="color: #71717a; font-size: 1.125rem;">
          No entries yet. Start writing your first journal entry!
        </p>
      </div>
    {/each}
  </div>
</div>