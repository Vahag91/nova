import { buildPayload } from './payloadBuilder';

// Build a snapshot ending at the original question. A later thread summary
// must not leak future answers into a retry of an earlier turn.
export function regenerationPayload(thread, messageId, tokenCap) {
  const messages = thread?.messages || [];
  const index = messages.findIndex(message => message.id === messageId);
  if (index < 0 || messages[index].role !== 'assistant') {
    throw new Error('The answer is no longer available.');
  }
  let questionIndex = index - 1;
  while (questionIndex >= 0 && messages[questionIndex].role !== 'user') questionIndex--;
  if (questionIndex < 0) throw new Error('The original question is no longer available.');
  const question = messages[questionIndex];
  const newMsg = { ...question, content: question.mm || question.content };
  return buildPayload({
    thread: { ...thread, summary: '', messages: messages.slice(0, questionIndex + 1) },
    newMsg,
    tokenCap,
  });
}

// Commit only a complete replacement. Cancellation, errors and stale callbacks
// leave the saved answer and all subsequent messages intact.
export function regenerateReply({ thread, messageId, tokenCap, model, allowWebSearch,
  ensureDeviceId, streamChat, onToken, onCommit, onError, onFinish }) {
  const controller = new AbortController();
  let finished = false;
  let answer = '';
  const finish = () => {
    if (finished) return;
    finished = true;
    onFinish();
  };
  const fail = error => {
    if (finished) return;
    onError(error);
    finish();
  };
  const operation = {
    abort() {
      if (finished) return;
      finish();
      controller.abort();
    },
  };
  // Defer setup so the caller can install the synchronous single-flight lock.
  Promise.resolve().then(async () => {
    if (finished) return;
    const messages = regenerationPayload(thread, messageId, tokenCap);
    const deviceId = await ensureDeviceId();
    if (finished) return;
    streamChat({
      model, messages, deviceId, allowWebSearch,
      webSearchConfig: { recencyDays: 30 }, signal: controller.signal,
      onToken: chunk => {
        if (finished || typeof chunk !== 'string') return;
        answer += chunk;
        onToken(chunk);
      },
      onDone: () => {
        if (finished) return;
        if (!answer.trim()) {
          fail(new Error('No answer was received. Please try again.'));
          return;
        }
        onCommit(answer);
        finish();
      },
      onError: fail,
    });
  }).catch(fail);
  return operation;
}
