import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceAssistantService, VoiceActionResult } from '../services/voiceAssistant';

interface Props {
  visible: boolean;
  onClose: () => void;
  onActionCompleted?: () => void;
}

export const VoiceAssistantModal: React.FC<Props> = ({ visible, onClose, onActionCompleted }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<VoiceActionResult | null>(null);

  const handleCommand = async (command: string) => {
    if (!command.trim()) return;
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

  const samplePrompts = [
    'Log 250 ml of water',
    'Remind me to call John at 8 PM',
    'Add task complete presentation',
    'How much water did I drink?',
    'What are my tasks?',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.micCircle}>
                <Ionicons name="mic" size={24} color="#38BDF8" />
              </View>
              <Text style={styles.title}>Luphonix Voice Assistant</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={styles.subtitle}>
            Speak or type commands to log water, manage tasks, or schedule reminders.
          </Text>

          {/* Input Row */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Log 350 ml of water..."
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleCommand(inputText)}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={() => handleCommand(inputText)}
              disabled={!inputText.trim() || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Assistant Feedback Box */}
          {lastResult && (
            <View style={styles.feedbackBox}>
              <Ionicons name="volume-high" size={20} color="#38BDF8" style={{ marginRight: 8 }} />
              <Text style={styles.feedbackText}>{lastResult.message}</Text>
            </View>
          )}

          {/* Suggestions */}
          <Text style={styles.suggestionsTitle}>Quick Suggestions:</Text>
          <View style={styles.suggestionsList}>
            {samplePrompts.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={styles.chip}
                onPress={() => handleCommand(prompt)}
              >
                <Ionicons name="flash-outline" size={14} color="#38BDF8" style={{ marginRight: 4 }} />
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeBtn: {
    padding: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 10,
  },
  sendBtn: {
    backgroundColor: '#0284C7',
    padding: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  feedbackBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  feedbackText: {
    color: '#E0F2FE',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
});
