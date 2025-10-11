import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

// SVG Icon Components
const StoryIcon = ({ color, size = 28 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-160q-48-38-104-59t-116-21q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740v484q51-32 107-48t113-16q36 0 70.5 6t69.5 18v-480q15 5 29.5 10.5T898-752q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-60 0-116 21t-104 59Zm80-200v-380l200-200v400L560-360Zm-160 65v-396q-33-14-68.5-21.5T260-720q-37 0-72 7t-68 21v397q35-13 69.5-19t70.5-6q36 0 70.5 6t69.5 19Zm0 0v-396 396Z"/>
  </Svg>
);

const TravelIcon = ({ color, size = 28 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M120-120v-80h720v80H120Zm70-200L40-570l96-26 112 94 140-37-207-276 116-31 299 251 170-46q32-9 60.5 7.5T864-585q9 32-7.5 60.5T808-487L190-320Z"/>
  </Svg>
);

const ConceptIcon = ({ color, size = 28 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M240-80v-172q-57-52-88.5-121.5T120-520q0-150 105-255t255-105q125 0 221.5 73.5T827-615l52 205q5 19-7 34.5T840-360h-80v120q0 33-23.5 56.5T680-160h-80v80h-80v-160h160v-200h108l-38-155q-23-91-98-148t-172-57q-116 0-198 81t-82 197q0 60 24.5 114t69.5 96l26 24v208h-80Zm254-360Zm-14 120q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm-30-128h61q0-25 6.5-40.5T544-526q18-20 35-40.5t17-53.5q0-42-32.5-71T483-720q-40 0-72.5 23T365-637l55 23q7-22 24.5-35.5T483-663q22 0 36.5 12t14.5 31q0 21-12.5 37.5T492-549q-20 21-31 42t-11 59Z"/>
  </Svg>
);

const CalendarIcon = ({ color, size = 28 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm80 240v-80h400v80H280Zm0 160v-80h280v80H280Z"/>
  </Svg>
);

const renderIcon = (iconType, color) => {
  switch (iconType) {
    case 'story':
      return <StoryIcon color={color} />;
    case 'travel':
      return <TravelIcon color={color} />;
    case 'concept':
      return <ConceptIcon color={color} />;
    case 'calendar':
      return <CalendarIcon color={color} />;
    default:
      return null;
  }
};

const SuggestionCards = ({ onSuggestionPress }) => {
  const { t } = useTranslation();

  const suggestions = [
    {
      id: 'write-story',
      icon: 'story',
      title: t('chat.suggestions.writeStory'),
      subtitle: t('chat.suggestions.writeStorySubtitle'),
      color: '#D16D6A'
    },
    {
      id: 'travel-plan',
      icon: 'travel',
      title: t('chat.suggestions.planTravel'),
      subtitle: t('chat.suggestions.planTravelSubtitle'),
      color: '#EA33F7'
    },
    {
      id: 'explain-concept',
      icon: 'concept',
      title: t('chat.suggestions.explainConcept'),
      subtitle: t('chat.suggestions.explainConceptSubtitle'),
      color: '#75FB4C'
    },
    {
      id: 'plan-day',
      icon: 'calendar',
      title: t('chat.suggestions.planDay'),
      subtitle: t('chat.suggestions.planDaySubtitle'),
      color: '#8C1AF6'
    }
  ];

  const handlePress = (suggestion) => {
    if (onSuggestionPress) {
      onSuggestionPress(suggestion);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {suggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            style={styles.card}
            onPress={() => handlePress(suggestion)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              {renderIcon(suggestion.icon, suggestion.color)}
            </View>
            <Text style={styles.title}>{suggestion.title}</Text>
            <Text style={styles.subtitle}>{suggestion.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // paddingHorizontal: 16,
    paddingVertical: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: '48%',
    height: 140,
    padding: 16,
    marginBottom: 6,
    borderWidth: 0.45,
    borderColor: colors.border,
    borderRadius: 12,
  },
  iconContainer: {
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
    lineHeight: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    color: colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    color: colors.textSecondary,
    lineHeight: 16,
  },
});

export default SuggestionCards;
