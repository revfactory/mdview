'use client';

import { create } from 'zustand';

export interface SearchResult {
  docId: string;
  title: string;
  snippet: string;
  score: number;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
}

interface SearchActions {
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;
}

export type SearchStore = SearchState & { actions: SearchActions };

export const useSearchStore = create<SearchStore>()((set) => ({
  query: '',
  results: [],
  isSearching: false,
  actions: {
    setQuery: (query) => set({ query }),
    setResults: (results) => set({ results }),
    setIsSearching: (isSearching) => set({ isSearching }),
  },
}));
