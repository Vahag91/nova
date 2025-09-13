export function groupModels(modelsMap) {
  const groups = {}; // { "OpenAI": [ { key, name, caps } ] }
  Object.entries(modelsMap || {}).forEach(([key, m]) => {
    const g = m.display?.group || m.provider || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push({
      key,
      name: m.display?.name || key,
      caps: m.caps || { text: true },
    });
  });
  Object.values(groups).forEach(list => list.sort((a,b)=>a.name.localeCompare(b.name)));
  return groups;
}

