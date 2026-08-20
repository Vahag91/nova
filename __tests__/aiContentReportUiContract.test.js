import fs from 'fs';
import path from 'path';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('AI content report UI contract', () => {
  test('provides a reason-only in-app report modal with all reviewer-visible states', () => {
    const modalSource = readSource('src/components/reporting/ReportContentModal.jsx');
    const english = JSON.parse(readSource('src/i18n/locales/en.json'));

    expect(modalSource).toContain("t('reportContent.title')");
    expect(modalSource).toContain("t('reportContent.subtitle')");
    expect(modalSource).toContain('reportContent.reasons.${option}');
    expect(english.reportContent.reasons).toEqual({
      sexual: 'Sexual or nudity content',
      violence_self_harm: 'Violence or self-harm',
      hate_harassment: 'Hate or harassment',
      child_safety: 'Child safety concern',
      scam_deceptive: 'Scam or deceptive content',
      other: 'Other',
    });
    expect(modalSource).not.toContain('Add details (optional)');
    expect(modalSource).not.toContain('TextInput');
    expect(modalSource).not.toContain('details,');
    expect(modalSource).toContain("t('reportContent.actions.submit')");
    expect(modalSource).toContain("t('reportContent.success.title')");
    expect(modalSource).toContain("t('reportContent.errors.submit')");
    expect(modalSource).toContain("t('reportContent.privateDisclosure')");
    expect(english.reportContent.actions.submit).toBe('Submit Report');
    expect(english.reportContent.success.title).toBe(
      'Thanks. Your report was submitted.',
    );
    expect(modalSource).toContain('submitAiContentReport');
  });

  test('exposes visible reporting on assistant responses with report evidence', () => {
    const bubbleSource = readSource('src/components/chat/MessageBubble.jsx');
    const listSource = readSource('src/components/chat/MessageList.jsx');
    const chatSource = readSource('src/screens/Chat.js');

    expect(bubbleSource).toContain('onReport');
    expect(bubbleSource).toContain("defaultValue: 'Report'");
    expect(bubbleSource).toContain('{reportLabel}');
    expect(bubbleSource).toContain('<SvgIcon name="flag" size={18} color={colors.textSecondary} />');
    expect(bubbleSource).not.toContain('reportButtonText');
    expect(bubbleSource).not.toContain('#E9C5FF');
    expect(bubbleSource).not.toContain('modelTag');
    expect(bubbleSource).not.toContain('modelText');
    expect(listSource).toContain('onReport');
    expect(listSource).toContain('previousUserMessage');
    expect(chatSource).toContain('ReportContentModal');
    expect(chatSource).toContain("content_type: 'chat_response'");
    expect(chatSource).toContain('output_text: message.content');
    expect(chatSource).toContain('private_chat: !!isPrivate');
    expect(chatSource).toContain('privateDisclosure={!!reportTarget?.metadata?.private_chat}');
    expect(chatSource).toContain('model: requestModelKey');
  });

  test('exposes reporting on new, edited, and saved generated images', () => {
    const resultSource = readSource(
      'src/components/create-image/CreateImageGenerating.jsx',
    );
    const viewerSource = readSource('src/components/image-studio/ImageViewer.jsx');
    const imageStoreSource = readSource('src/state/useImagesStore.js');

    expect(resultSource).toContain('ReportContentModal');
    expect(resultSource).toContain("mode === 'text2img'");
    expect(resultSource).toContain("'generated_image'");
    expect(resultSource).toContain("'edited_image'");
    expect(resultSource).toContain("source_screen: 'create_image_generating'");
    expect(resultSource).toContain('originalUrl');
    expect(resultSource).toContain("t('reportContent.actions.report')");
    expect(resultSource).toContain('<SvgIcon name="flag" size={22} color="rgba(255,255,255,0.92)" />');
    expect(resultSource).not.toContain('iconButtonReport');
    expect(resultSource).not.toContain('reportLabel');
    expect(resultSource).not.toContain('#E9C5FF');

    expect(viewerSource).toContain('ReportContentModal');
    expect(viewerSource).toContain("job?.mode === 'text2img'");
    expect(viewerSource).toContain("'generated_image'");
    expect(viewerSource).toContain("'edited_image'");
    expect(viewerSource).toContain("source_screen: 'image_viewer'");
    expect(viewerSource).toContain('originalUrl');
    expect(viewerSource).toContain("t('reportContent.actions.report')");
    expect(viewerSource).toContain('<SvgIcon name="flag" size={22} color="rgba(255,255,255,0.92)" />');
    expect(viewerSource).not.toContain('actionButtonReport');
    expect(viewerSource).not.toContain('reportLabel');
    expect(viewerSource).not.toContain('#E9C5FF');
    expect(imageStoreSource).toContain("mode: j.mode || 'text2img'");
  });
});
