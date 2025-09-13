export const Fonts = {
  regular: 'Lato-Regular',
  bold: 'Lato-Bold',
  boldItalic: 'Lato-BoldItalic',
};

export const getFontFamily = (weight = 'regular') => {
  switch (weight) {
    case 'bold':
      return Fonts.bold;
    case 'boldItalic':
      return Fonts.boldItalic;
    case 'regular':
    default:
      return Fonts.regular;
  }
};
