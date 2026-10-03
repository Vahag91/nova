import { documentCoverage } from './documentCoverage';
// Validate at both network and disk boundaries so malformed data cannot reach UI.
const invalid = () =>
  Object.assign(new Error('Invalid source brief'), { code: 'INVALID_RESULT' });
const string = (value, max = 30000) => {
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value;
};
const list = (value, map, max = 100) => {
  if (!Array.isArray(value) || value.length > max) throw invalid();
  return value.map(map);
};

export function validateWorkspaceResult(raw) {
  if (!raw || !raw.title?.trim?.() || !raw.overview?.trim?.()) throw invalid();
  const result = {
    title: string(raw.title, 300),
    overview: string(raw.overview),
    keyPoints: list(raw.keyPoints, value => string(value)),
    sections: list(raw.sections || [], section => ({
      title: string(section?.title, 500),
      body: string(section?.body),
      startSeconds: section?.startSeconds == null ? null : section.startSeconds,
    })),
    actions: list(raw.actions || [], value => string(value)),
    evidence: list(raw.evidence || [], evidence => ({
      sourceIndex: evidence?.sourceIndex,
      sourceName: string(evidence?.sourceName, 300),
      quote: string(evidence?.quote, 2000),
    })),
    limitations: list(raw.limitations || [], value => string(value)),
  };
  if (
    !result.keyPoints.length ||
    result.sections.some(
      s =>
        s.startSeconds !== null &&
        (!Number.isFinite(s.startSeconds) || s.startSeconds < 0),
    ) ||
    result.evidence.some(
      e => !Number.isInteger(e.sourceIndex) || e.sourceIndex < 0,
    )
  )
    throw invalid();
  const coverage = raw.coverage || {};
  result.coverage = {
    kind: typeof coverage.kind === 'string' ? coverage.kind : '',
    extractedChars:
      Number.isFinite(coverage.extractedChars) && coverage.extractedChars >= 0
        ? coverage.extractedChars
        : 0,
    possibleExtractionLimit: coverage.possibleExtractionLimit === true,
    ...(Number.isFinite(coverage.maxVideoSeconds) &&
    coverage.maxVideoSeconds > 0
      ? { maxVideoSeconds: coverage.maxVideoSeconds }
      : {}),
    ...(Number.isFinite(coverage.durationSeconds) &&
    coverage.durationSeconds > 0
      ? { durationSeconds: coverage.durationSeconds }
      : {}),
  };
  if (raw.sourceDocuments !== undefined)
    result.sourceDocuments = list(
      raw.sourceDocuments,
      doc => {
        if (
          doc?.kind !== 'document' ||
          typeof doc.id !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(doc.id)
        )
          throw invalid();
        return {
          id: doc.id,
          kind: 'document',
          status: 'ready',
          name: string(doc.name, 300),
          mimeType: string(doc.mimeType, 150),
          size: Number.isFinite(doc.size) ? doc.size : null,
          extractedChars: Number.isFinite(doc.extractedChars)
            ? doc.extractedChars
            : null,
          expiresAt: string(doc.expiresAt, 100),
          truncated: doc.truncated === true,
          ...documentCoverage(doc),
        };
      },
      3,
    );
  return result;
}

export function validateWorkspaceRecord(record) {
  if (
    !record ||
    typeof record.id !== 'string' ||
    !record.id ||
    !['document', 'youtube', 'upload', 'transcript'].includes(record.type) ||
    !Number.isFinite(record.createdAt) ||
    !Array.isArray(record.documents)
  )
    throw invalid();
  const documents = record.documents.map(doc => {
    if (doc?.kind !== 'document' || typeof doc.id !== 'string' || !doc.id)
      throw invalid();
    return {
      id: doc.id,
      kind: 'document',
      status: 'ready',
      name: string(doc.name, 300),
      mimeType: string(doc.mimeType, 150),
      size: Number.isFinite(doc.size) ? doc.size : null,
      extractedChars: Number.isFinite(doc.extractedChars)
        ? doc.extractedChars
        : null,
      expiresAt: typeof doc.expiresAt === 'string' ? doc.expiresAt : null,
      truncated: doc.truncated === true,
      ...documentCoverage(doc),
    };
  });
  const result = validateWorkspaceResult(record.result);
  if (record.type === 'document') {
    if (documents.some(doc => doc.truncated)) {
      result.coverage.possibleExtractionLimit = true;
    }
    result.evidence = result.evidence.map(evidence => ({
      ...evidence,
      sourceName: documents[evidence.sourceIndex]?.name || evidence.sourceName,
    }));
  }
  return {
    id: record.id,
    type: record.type,
    createdAt: record.createdAt,
    sourceLabel: string(record.sourceLabel, 2048),
    url: record.url == null ? null : string(record.url, 2048),
    demo: record.demo === true,
    result,
    documents,
  };
}
