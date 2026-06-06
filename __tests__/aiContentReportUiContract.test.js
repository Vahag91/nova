import fs from 'fs';
import path from 'path';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('AI content report UI contract', () => {
  test('provides a reason-only in-app report modal with all reviewer-visible states', () => {
    const modalSource = readSource('src/components/reporting/ReportContentModal.jsx');

    expect(modalSource).toContain('Report AI content');
    expect(modalSource).toContain('Tell us what is wrong with this generated content.');
    expect(modalSource).toContain('Sexual or nudity content');
    expect(modalSource).toContain('Violence or self-harm');
    expect(modalSource).toContain('Hate or harassment');
    expect(modalSource).toContain('Child safety concern');
    expect(modalSource).toContain('Scam or deceptive content');
    expect(modalSource).toContain('Other');
    expect(modalSource).not.toContain('Add details (optional)');
    expect(modalSource).not.toContain('TextInput');
    expect(modalSource).not.toContain('details,');
    expect(modalSource).toContain('Submit Report');
    expect(modalSource).toContain('Thanks. Your report was submitted.');
    expect(modalSource).toContain('Could not submit report. Please try again.');
    expect(modalSource).toContain(
      'Submitting sends this reported content for safety review.',
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
    expect(resultSource).toContain('>Report</Text>');
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
    expect(viewerSource).toContain('>Report</Text>');
    expect(viewerSource).toContain('<SvgIcon name="flag" size={22} color="rgba(255,255,255,0.92)" />');
    expect(viewerSource).not.toContain('actionButtonReport');
    expect(viewerSource).not.toContain('reportLabel');
    expect(viewerSource).not.toContain('#E9C5FF');
    expect(imageStoreSource).toContain("mode: j.mode || 'text2img'");
  });
});
