import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { Task, Priority, TaskCategory, Subtask } from '../types';
import * as Haptics from 'expo-haptics';

export const TasksScreen: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  // New Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Work');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const loadTasks = useCallback(async () => {
    const list = await StorageService.getTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const toggleTaskCompleted = async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            isCompleted: !t.isCompleted,
            completedAt: !t.isCompleted ? new Date().toISOString() : undefined,
          }
        : t
    );
    setTasks(updated);
    await StorageService.saveTasks(updated);
  };

  const deleteTask = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    await StorageService.saveTasks(updated);
  };

  const handleSaveTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title');
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: taskTitle.trim(),
      notes: taskNotes.trim() || undefined,
      priority: taskPriority,
      category: taskCategory,
      isCompleted: false,
      subtasks: subtasks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newTask, ...tasks];
    setTasks(updated);
    await StorageService.saveTasks(updated);

    // Reset form
    setTaskTitle('');
    setTaskNotes('');
    setTaskPriority('medium');
    setSubtasks([]);
    setIsModalVisible(false);
  };

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtaskTitle.trim(), completed: false }]);
    setNewSubtaskTitle('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending' && t.isCompleted) return false;
    if (filter === 'completed' && !t.isCompleted) return false;
    if (filter === 'high' && t.priority !== 'high') return false;
    if (searchQuery.trim()) {
      return (
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed', 'high'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={48} color="#334155" />
            <Text style={styles.emptyTitle}>No tasks found</Text>
            <Text style={styles.emptySubtitle}>Tap the '+' button to create a new task</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.taskCard, item.isCompleted && styles.taskCardCompleted]}>
            <TouchableOpacity onPress={() => toggleTaskCompleted(item)} style={styles.checkBtn}>
              <Ionicons
                name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={item.isCompleted ? '#10B981' : '#64748B'}
              />
            </TouchableOpacity>

            <View style={styles.taskBody}>
              <Text
                style={[styles.taskTitle, item.isCompleted && styles.taskTitleCompleted]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {item.notes ? (
                <Text style={styles.taskNotes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}

              <View style={styles.tagRow}>
                <View
                  style={[
                    styles.priorityTag,
                    item.priority === 'high' && styles.priorityTagHigh,
                    item.priority === 'medium' && styles.priorityTagMedium,
                    item.priority === 'low' && styles.priorityTagLow,
                  ]}
                >
                  <Text style={styles.tagText}>{item.priority}</Text>
                </View>
                <View style={styles.categoryTag}>
                  <Text style={styles.tagText}>{item.category}</Text>
                </View>
                {item.subtasks.length > 0 && (
                  <View style={styles.subtasksTag}>
                    <Ionicons name="list" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                    <Text style={styles.tagText}>
                      {item.subtasks.filter((s) => s.completed).length}/{item.subtasks.length}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity onPress={() => deleteTask(item.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Task</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="What needs to be done?"
              placeholderTextColor="#64748B"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Notes or details (optional)"
              placeholderTextColor="#64748B"
              value={taskNotes}
              onChangeText={setTaskNotes}
              multiline
              numberOfLines={3}
            />

            {/* Priority Selector */}
            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.selectorRow}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.selectorBtn, taskPriority === p && styles.selectorBtnActive]}
                  onPress={() => setTaskPriority(p)}
                >
                  <Text style={[styles.selectorText, taskPriority === p && styles.selectorTextActive]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.selectorRow}>
              {(['Work', 'Personal', 'Health', 'Study', 'Other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.selectorBtn, taskCategory === cat && styles.selectorBtnActive]}
                  onPress={() => setTaskCategory(cat)}
                >
                  <Text style={[styles.selectorText, taskCategory === cat && styles.selectorTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subtasks */}
            <Text style={styles.fieldLabel}>Checklist / Subtasks</Text>
            <View style={styles.subtaskInputRow}>
              <TextInput
                style={styles.subtaskInput}
                placeholder="Add subtask..."
                placeholderTextColor="#64748B"
                value={newSubtaskTitle}
                onChangeText={setNewSubtaskTitle}
              />
              <TouchableOpacity style={styles.addSubtaskBtn} onPress={addSubtask}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {subtasks.map((s, idx) => (
              <View key={idx} style={styles.subtaskItem}>
                <Ionicons name="ellipse-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.subtaskText}>{s.title}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.saveTaskBtn} onPress={handleSaveTask}>
              <Text style={styles.saveTaskBtnText}>Save Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 80,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  taskCardCompleted: {
    opacity: 0.6,
  },
  checkBtn: {
    paddingTop: 2,
    marginRight: 10,
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  taskNotes: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityTagHigh: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  priorityTagMedium: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  priorityTagLow: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  categoryTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subtasksTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTextArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  selectorText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  selectorTextActive: {
    color: '#FFFFFF',
  },
  subtaskInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtaskInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  addSubtaskBtn: {
    backgroundColor: '#0284C7',
    padding: 10,
    borderRadius: 10,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  subtaskText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  saveTaskBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveTaskBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
