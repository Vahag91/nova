// Development-only fixtures. Never claim these are generated from user content.
export function createWorkspaceDemo(type) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) throw new Error('Demo unavailable');
  const video = type !== 'document';
  return {
    id: `demo-${type}-${Date.now()}`, type, demo: true, createdAt: Date.now(),
    sourceLabel: 'Local sample — community garden planning', url: null, documents: [],
    result: {
      title: 'Sample brief: Community garden',
      overview: 'LOCAL DEMO — This is a fixed sample, not an analysis of your files or video. The fictional team plans a small community garden with tomatoes and herbs.',
      keyPoints: ['The team chose tomatoes and herbs.', 'Planting is planned for April.', 'The materials budget is 200 units.'],
      sections: [{ title: 'Plan and budget', body: 'The team discusses crops, timing and the available materials budget.', startSeconds: video ? 0 : null },
        { title: 'Next steps', body: 'Alex will prepare the materials list by Friday.', startSeconds: video ? 45 : null }],
      actions: ['Alex: prepare the materials list by Friday.'],
      evidence: video ? [] : [{ sourceIndex: 0, sourceName: 'Fictional sample', quote: 'Plant tomatoes and herbs in April.' }],
      limitations: ['Fixed local sample for interface testing. No source was uploaded and no AI service was called.'],
      coverage: { kind: video ? 'video' : 'extracted_text', extractedChars: 281, possibleExtractionLimit: false },
    },
  };
}
