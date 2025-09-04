import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Button,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  NavigationContainer,
  useFocusEffect,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';

// ---------------- Helper Functions ----------------
const isToday = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

const isThisWeek = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const firstDayOfWeek = new Date();
  firstDayOfWeek.setDate(now.getDate() - now.getDay());
  firstDayOfWeek.setHours(0, 0, 0, 0);
  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
  lastDayOfWeek.setHours(23, 59, 59, 999);
  return d >= firstDayOfWeek && d <= lastDayOfWeek;
};

const isThisMonth = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

// ---------------- Home Screen ----------------
function HomeScreen() {
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({ today: 0, week: 0, month: 0 });
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [search, setSearch] = useState('');

  const loadExpenses = async () => {
    const existing = await AsyncStorage.getItem('expenses');
    const data = existing ? JSON.parse(existing) : [];
    setExpenses(data);

    const catData = await AsyncStorage.getItem('categories');
    const cats = catData
      ? JSON.parse(catData)
      : ['Food', 'Transport', 'Shopping', 'Bills', 'Other'];
    setCategories(cats);

    let today = 0,
      week = 0,
      month = 0;
    data.forEach((exp) => {
      if (isToday(exp.date)) today += exp.amount;
      if (isThisWeek(exp.date)) week += exp.amount;
      if (isThisMonth(exp.date)) month += exp.amount;
    });
    setTotals({ today, week, month });
  };

  useFocusEffect(
    React.useCallback(() => {
      loadExpenses();
    }, [])
  );

  const groupByDate = (data) => {
    const grouped = {};
    data.forEach((exp) => {
      const d = new Date(exp.date).toDateString();
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(exp);
    });
    return grouped;
  };

  let filtered = [...expenses];
  if (filterCategory) {
    filtered = filtered.filter((e) => e.category === filterCategory);
  }
  if (search.trim()) {
    filtered = filtered.filter((e) =>
      e.note.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (sortMode === 'latest') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (sortMode === 'highest') {
    filtered.sort((a, b) => b.amount - a.amount);
  }

  const groupedExpenses = groupByDate(filtered);

  const renderGroup = ({ item }) => {
    const [date, items] = item;
    return (
      <View style={{ marginTop: 15 }}>
        <Text style={styles.dateHeader}>{date}</Text>
        {items.map((exp) => (
          <View key={exp.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {exp.category}: ${exp.amount}
            </Text>
            {exp.note ? <Text style={styles.note}>📝 {exp.note}</Text> : null}
            <Text style={styles.time}>
              {new Date(exp.date).toLocaleTimeString()}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏠 Overview</Text>

      {/* Totals */}
      <View style={styles.totalsRow}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Today</Text>
          <Text style={styles.totalValue}>${totals.today.toFixed(2)}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>This Week</Text>
          <Text style={styles.totalValue}>${totals.week.toFixed(2)}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>This Month</Text>
          <Text style={styles.totalValue}>${totals.month.toFixed(2)}</Text>
        </View>
      </View>

      {/* Search */}
      <TextInput
        style={styles.input}
        placeholder="🔍 Search by note..."
        value={search}
        onChangeText={setSearch}
      />

      {/* Filter */}
      <Picker
        selectedValue={filterCategory}
        style={styles.input}
        onValueChange={(val) => setFilterCategory(val)}
      >
        <Picker.Item label="All Categories" value="" />
        {categories.map((cat, i) => (
          <Picker.Item key={i} label={cat} value={cat} />
        ))}
      </Picker>

      {/* Sort */}
      <Picker
        selectedValue={sortMode}
        style={styles.input}
        onValueChange={(val) => setSortMode(val)}
      >
        <Picker.Item label="Latest First" value="latest" />
        <Picker.Item label="Highest Amount First" value="highest" />
      </Picker>

      {/* Expenses */}
      <FlatList
        data={Object.entries(groupedExpenses)}
        keyExtractor={(item) => item[0]}
        renderItem={renderGroup}
      />
    </View>
  );
}

// ---------------- Add Expense Screen ----------------
function AddExpenseScreen() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState([]);

  const loadCategories = async () => {
    const existing = await AsyncStorage.getItem('categories');
    const data = existing
      ? JSON.parse(existing)
      : ['Food', 'Transport', 'Shopping', 'Bills', 'Other'];
    setCategories(data);
    if (data.length > 0 && !category) setCategory(data[0]);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadCategories();
    }, [])
  );

  const saveExpense = async () => {
    if (!amount || !category) {
      alert('Please enter amount and category');
      return;
    }
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      alert('Enter a valid amount');
      return;
    }

    const newExpense = {
      id: Date.now().toString(),
      amount: parsed,
      category,
      note: note.trim(),
      date: new Date().toISOString(),
    };

    try {
      const existing = await AsyncStorage.getItem('expenses');
      const expenses = existing ? JSON.parse(existing) : [];
      expenses.push(newExpense);
      await AsyncStorage.setItem('expenses', JSON.stringify(expenses));

      setAmount('');
      setNote('');
      alert('Expense saved ✅');
    } catch (err) {
      console.log(err);
      alert('Could not save expense');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>➕ Add Expense</Text>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder="💰 Amount e.g. 199.99"
      />

      <Picker
        selectedValue={category}
        style={styles.input}
        onValueChange={(itemValue) => setCategory(itemValue)}
      >
        {categories.map((cat, idx) => (
          <Picker.Item key={idx} label={cat} value={cat} />
        ))}
      </Picker>

      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="📝 Note (optional)"
      />

      <View style={{ marginTop: 20 }}>
        <Button title="Save Expense" onPress={saveExpense} />
      </View>
    </View>
  );
}

// ---------------- Settings Screen ----------------
function SettingsScreen() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');

  const loadCategories = async () => {
    const existing = await AsyncStorage.getItem('categories');
    const data = existing
      ? JSON.parse(existing)
      : ['Food', 'Transport', 'Shopping', 'Bills', 'Other'];
    setCategories(data);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadCategories();
    }, [])
  );

  const addCategory = async () => {
    if (!newCategory.trim()) {
      alert('Enter a valid category');
      return;
    }
    const updated = [...categories, newCategory.trim()];
    setCategories(updated);
    setNewCategory('');
    await AsyncStorage.setItem('categories', JSON.stringify(updated));
  };

  const clearData = async () => {
    Alert.alert('Confirm', 'Clear all expenses?', [
      { text: 'Cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          await AsyncStorage.removeItem('expenses');
          alert('All data cleared ✅');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Settings</Text>

      <Text style={styles.subtitle}>Categories</Text>
      {categories.map((cat, i) => (
        <Text key={i} style={styles.categoryItem}>
          • {cat}
        </Text>
      ))}

      <TextInput
        style={styles.input}
        placeholder="➕ Add new category"
        value={newCategory}
        onChangeText={setNewCategory}
      />
      <Button title="Add Category" onPress={addCategory} />

      <View style={{ marginTop: 30 }}>
        <Button title="Clear All Data" color="red" onPress={clearData} />
      </View>
    </View>
  );
}

// ---------------- Navigation ----------------
const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Add Expense" component={AddExpenseScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  note: {
    color: '#475569',
    marginTop: 4,
  },
  time: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
    color: '#2563EB',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  totalBox: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    color: '#1E3A8A',
  },
  categoryItem: {
    fontSize: 14,
    color: '#334155',
    marginTop: 4,
  },
});
