<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { tagStore, tags } from '../stores/tags.js';
  import { getTagColor } from '../utils/tagColors.js';
  import { capitalize } from '../utils/text.js';
  import type { Tag } from '../database/db.js';

  export let selectedTags: string[] = [];
  
  const dispatch = createEventDispatcher<{
    tagsChanged: string[];
  }>();

  let inputValue = '';
  let showSuggestions = false;
  let suggestions: Tag[] = [];
  let inputElement: HTMLInputElement;
  let suggestionsContainer: HTMLDivElement;
  let selectedSuggestionIndex = -1;

  onMount(() => {
    tagStore.loadAll();
  });

  async function handleInput() {
    if (inputValue.trim()) {
      suggestions = await tagStore.searchTags(inputValue);
      showSuggestions = suggestions.length > 0;
      selectedSuggestionIndex = -1;
    } else {
      showSuggestions = false;
      suggestions = [];
    }
  }

  function addTag(tagName: string) {
    const trimmedTag = tagName.toLowerCase().trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      selectedTags = [...selectedTags, trimmedTag];
      dispatch('tagsChanged', selectedTags);
      tagStore.create(trimmedTag);
    }
    inputValue = '';
    showSuggestions = false;
    inputElement.focus();
  }

  function removeTag(tagToRemove: string) {
    selectedTags = selectedTags.filter(tag => tag !== tagToRemove);
    dispatch('tagsChanged', selectedTags);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        addTag(suggestions[selectedSuggestionIndex].name);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
    } else if (event.key === 'Escape') {
      showSuggestions = false;
      selectedSuggestionIndex = -1;
    } else if (event.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (suggestionsContainer && !suggestionsContainer.contains(event.target as Node) && 
        !inputElement.contains(event.target as Node)) {
      showSuggestions = false;
    }
  }


  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="relative">
  <!-- Tag Input Container -->
  <div class="flex flex-wrap transition-fast" style="gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--border-light); border-radius: var(--radius-lg); background: var(--background-primary); min-height: 48px;">
    <!-- Selected Tags -->
    {#each selectedTags as tag}
      <div 
        class="inline-flex items-center text-white transition-fast"
        style="padding: var(--space-1) var(--space-2); font-size: var(--text-xs); font-weight: var(--font-medium); border-radius: var(--radius-full); background-color: {getTagColor(tag, $tags)}"
      >
        {capitalize(tag)}
        <button
          onclick={() => removeTag(tag)}
          class="rounded-full transition-fast"
          style="margin-left: var(--space-2); padding: var(--space-1); opacity: 0.7;"
          title="Remove tag"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}

    <!-- Input Field -->
    <input
      bind:this={inputElement}
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeyDown}
      onfocus={handleInput}
      placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
      class="flex-1 bg-transparent border-none outline-none"
      style="min-width: 128px; font-size: var(--text-sm); color: var(--text-primary);"
    />
  </div>

  <!-- Suggestions Dropdown -->
  {#if showSuggestions && suggestions.length > 0}
    <div 
      bind:this={suggestionsContainer}
      class="absolute z-30 w-full mt-2 max-h-48 overflow-y-auto"
      style="background: var(--background-primary); border: 1px solid var(--border-light); border-radius: var(--radius-lg); box-shadow: 0 4px 12px var(--shadow-hover);"
    >
      <div style="padding: var(--space-1);">
        {#each suggestions as suggestion, index}
          <button
            onclick={() => addTag(suggestion.name)}
            class="w-full text-left rounded flex items-center justify-between transition-fast"
            style="padding: var(--space-3) var(--space-3); background: {index === selectedSuggestionIndex ? 'var(--accent-blue-light)' : 'transparent'}; color: {index === selectedSuggestionIndex ? 'var(--accent-blue)' : 'var(--text-primary)'};"
          >
            <div class="flex items-center" style="gap: var(--space-2);">
              <span 
                class="w-3 h-3 rounded-full"
                style="background-color: {suggestion.color}"
              ></span>
              <span style="font-size: var(--text-sm);">{capitalize(suggestion.name)}</span>
            </div>
            <span style="font-size: var(--text-xs); color: var(--text-secondary);">
              {suggestion.usageCount}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Helper Text -->
  <div style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-secondary);">
    <p>Type to search or create tags • Press Enter to add • Backspace to remove</p>
  </div>
</div>