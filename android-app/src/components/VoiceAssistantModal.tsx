import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Haptics from 'expo-haptics';
import { VoiceAssistantService, VoiceActionResult } from '../services/voiceAssistant';

interface Props {
  visible: boolean;
  onClose: () => void;
  onActionCompleted?: () => void;
}

export const VoiceAssistantModal: React.FC<Props> = ({ visible, onClose, onActionCompleted }) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<VoiceActionResult | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation while listening
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isListening) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isListening, pulseAnim]);

  // Speech recognition events
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript || '';
    if (text) {
      setInputText(text);
      if (event.isFinal) {
        handleCommand(text);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    console.warn('Speech recognition error:', event.error);
  });

  const toggleListening = async () => {
    try {
      if (isListening) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
        if (inputText.trim()) {
          handleCommand(inputText.trim());
        }
      } else {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Please grant microphone permission to use voice commands.'
          );
          return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setInputText('');
        setLastResult(null);

        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
        });
      }
    } catch (err: any) {
      console.warn('Failed to toggle speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleCommand = async (command: string) => {
    if (!command.trim()) return;

    if (isListening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
      setIsListening(false);
    }

    setIsProcessing(true);
    setLastResult(null);

    const result = await VoiceAssistantService.processCommand(command);
    setLastResult(result);
    setIsProcessing(false);
    setInputText('');
    if (onActionCompleted) {
      onActionCompleted();
    }
  };

  const handleClose = () => {
    if (isListening) {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
      setIsListening(false);
    }
    onClose();
  };

  const samplePrompts = [
    'Log 250 ml of water',
    'Add task design presentation deck',
    'Assign task review code to alex',
    'Remind me to take vitamins at 8 PM',
    'How much water did I drink?',
    'What are my tasks?',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.micCircle}>
                <Ionicons name="sparkles" size={20} color="#38BDF8" />
              </View>
              <View>
                <Text style={styles.title}>Luphonix Voice Assistant</Text>
                <Text style={styles.headerSub}>AI & Natural Speech Engine</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Big Voice Recognition Mic Orb */}
          <View style={styles.voiceOrbSection}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleListening}
              style={styles.micOrbContainer}
            >
              <Animated.View
                style={[
                  styles.micOrbPulseRing,
                  isListening && styles.micOrbPulseRingActive,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={[styles.micOrbButton, isListening && styles.micOrbButtonActive]}>
                <Ionicons
                  name={isListening ? 'mic' : 'mic-outline'}
                  size={36}
                  color={isListening ? '#FFFFFF' : '#38BDF8'}
                />
              </View>
            </TouchableOpacity>
            <Text style={[styles.micOrbStatus, isListening && styles.micOrbStatusActive]}>
              {isListening
                ? 'Listening... speak command now'
                : 'Tap microphone to speak command'}
            </Text>
          </View>

          {/* Transcript / Input Row */}
          <View style={styles.inputContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder={isListening ? 'Transcribing your voice...' : 'Speak or type command...'}
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleCommand(inputText)}
            />
            {inputText.trim() ? (
              <TouchableOpacity
                style={[styles.sendBtn, isProcessing && styles.sendBtnDisabled]}
                onPress={() => handleCommand(inputText)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Assistant Feedback Box */}
          {lastResult && (
            <View style={styles.feedbackBox}>
              <Ionicons name="volume-high" size={20} color="#38BDF8" style={{ marginRight: 8 }} />
              <Text style={styles.feedbackText}>{lastResult.message}</Text>
            </View>
          )}

          {/* Suggestions */}
          <Text style={styles.suggestionsTitle}>Suggested Commands:</Text>
          <View style={styles.suggestionsList}>
            {samplePrompts.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={styles.chip}
                onPress={() => handleCommand(prompt)}
              >
                <Ionicons name="flash-outline" size={13} color="#38BDF8" style={{ marginRight: 4 }} />
                <Text style={styles.chipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
  },
  voiceOrbSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  micOrbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 88,
    height: 88,
  },
  micOrbPulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  micOrbPulseRingActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.35)',
  },
  micOrbButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  micOrbButtonActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  micOrbStatus: {
    marginTop: 10,
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  micOrbStatusActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    paddingVertical: 8,
  },
  sendBtn: {
    backgroundColor: '#0284C7',
    padding: 8,
    borderRadius: 8,
    marginLeft: 6,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  feedbackBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  feedbackText: {
    color: '#E0F2FE',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
});
