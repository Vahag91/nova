import React from 'react';
import {Text} from 'react-native';
import { useTranslation } from 'react-i18next';

export default function History() {
  const { t } = useTranslation();
  return <Text>{t('navigation.history')}</Text>;
}
