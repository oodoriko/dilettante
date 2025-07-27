<script lang="ts">
  import { onMount } from 'svelte';
  import { entryStore } from '../stores/entries.js';
  import { tagStore, tags } from '../stores/tags.js';
  import { getTagColor } from '../utils/tagColors.js';
  import { capitalize } from '../utils/text.js';
  import TagInput from './TagInput.svelte';
  import type { JournalEntry } from '../database/db.js';

  export let entry: JournalEntry | null = null;
  export let onSave: (() => void) | undefined = undefined;

  let title = entry?.title || '';
  let content = entry?.content || '';
  let selectedTags = entry?.tags || [];
  let isEditing = !entry;
  let showEntryMenu = false;
  let showMoveToModal = false;
  let selectedMoveTags: string[] = [];

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

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

  function handleTagsChanged(event: CustomEvent<string[]>) {
    selectedTags = event.detail;
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

  function formatEntryDateTime(date: Date): { date: string; day: string; time: string } {
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      day: date.toLocaleDateString('en-US', { weekday: 'long' }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  }
</script>

<div class="h-full overflow-y-auto" style="background: var(--background-secondary);">
  <div class="editor-container" style="margin: var(--space-12) auto; max-width: 800px; padding: var(--space-12) var(--space-8);">
  {#if isEditing}
    <div style="display: flex; flex-direction: column; gap: var(--space-6);">
      <!-- Title Input -->
      <div>
        <input
          bind:value={title}
          placeholder="Entry title..."
          class="editor-title"
          maxlength="200"
        />
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

      <!-- Tags Input Section -->
      <div style="padding-top: var(--space-6); border-top: 1px solid var(--border-light);">
        <div style="margin-bottom: var(--space-4);">
          <label style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary);">Tags</label>
        </div>
        <TagInput {selectedTags} on:tagsChanged={handleTagsChanged} />
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
        
        {#if entry}
          <button
            onclick={() => isEditing = false}
            class="btn-secondary"
          >
            Cancel
          </button>
        {/if}
        
        <div class="ml-auto" style="display: flex; gap: var(--space-4); font-size: var(--text-xs); color: var(--text-secondary);">
          {#if title.trim()}
            <span>{title.trim().length}/200 characters</span>
          {/if}
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
            {@const createdDateTime = formatEntryDateTime(new Date(entry.createdAt || entry.timestamp))}
            {@const lastEditedDateTime = formatEntryDateTime(new Date(entry.lastEditedAt || entry.timestamp))}
            <div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">
              <div style="margin-bottom: var(--space-1);">
                <span style="font-weight: var(--font-medium); color: var(--text-tertiary);">Created:</span>
                <span style="font-weight: var(--font-medium); margin-left: var(--space-1);">{createdDateTime.date}</span>
                <span style="margin: 0 var(--space-2); color: var(--text-tertiary);">•</span>
                <span>{createdDateTime.day}</span>
                <span style="margin: 0 var(--space-2); color: var(--text-tertiary);">•</span>
                <span>{createdDateTime.time}</span>
              </div>
              {#if entry.lastEditedAt && entry.lastEditedAt.getTime() !== (entry.createdAt || entry.timestamp).getTime()}
                <div>
                  <span style="font-weight: var(--font-medium); color: var(--text-tertiary);">Last edited:</span>
                  <span style="font-weight: var(--font-medium); margin-left: var(--space-1);">{lastEditedDateTime.date}</span>
                  <span style="margin: 0 var(--space-2); color: var(--text-tertiary);">•</span>
                  <span>{lastEditedDateTime.day}</span>
                  <span style="margin: 0 var(--space-2); color: var(--text-tertiary);">•</span>
                  <span>{lastEditedDateTime.time}</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        
        <div class="flex items-center gap-2">
          <button
            onclick={startEditing}
            class="btn-secondary"
            title="Edit entry"
            style="padding: var(--space-2);"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

      <!-- Tags Display -->
      {#if entry.tags && entry.tags.length > 0}
        <div style="padding-top: var(--space-4); border-top: 1px solid var(--border-light);">
          <div class="flex flex-wrap" style="gap: var(--space-2);">
            {#each entry.tags as tag}
              <span class="text-white" style="padding: var(--space-1) var(--space-2); font-size: var(--text-xs); background-color: {getTagColor(tag, $tags)}; border-radius: var(--radius-sm);">
                {capitalize(tag)}
              </span>
            {/each}
          </div>
        </div>
      {/if}
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