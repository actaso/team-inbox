import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Score } from '@/types/task';

const TASKS_COLLECTION = 'tasks';
const PEOPLE_COLLECTION = 'people';
const PROJECTS_COLLECTION = 'projects';
const PROJECT_FIELD = 'projectId';

export interface FirestoreTask {
  id?: string;
  title: string;
  notes?: string;
  impact: Score;
  confidence: Score;
  ease: Score;
  assignee?: string;
  done: boolean;
  createdAt: Timestamp;
  userId: string;
}

export interface FirestorePerson {
  id?: string;
  name: string;
  createdAt: Timestamp;
}

// Convert Firestore document to Task
export const firestoreTaskToTask = (doc: QueryDocumentSnapshot<DocumentData>): Task => {
  const data = doc.data() as FirestoreTask;
  return {
    id: doc.id,
    title: data.title,
    notes: data.notes || '',
    impact: data.impact,
    confidence: data.confidence,
    ease: data.ease,
    assignee: data.assignee || undefined, // Handle missing/null assignee
    done: data.done,
    createdAt: data.createdAt.toMillis(),
  };
};

// Convert Task to Firestore format
export const taskToFirestoreTask = (task: Task, userId: string, projectId: string): Record<string, unknown> => {
  const firestoreTask: Record<string, unknown> = {
    title: task.title,
    notes: task.notes || '',
    impact: task.impact,
    confidence: task.confidence,
    ease: task.ease,
    done: task.done,
    createdAt: Timestamp.fromMillis(task.createdAt),
    userId,
    [PROJECT_FIELD]: projectId,
  };
  
  // Only include assignee if it's not undefined
  if (task.assignee !== undefined && task.assignee !== null) {
    firestoreTask.assignee = task.assignee;
  }
  
  return firestoreTask;
};

// Tasks operations
export const getTasks = async (projectId: string): Promise<Task[]> => {
  const base = collection(db, TASKS_COLLECTION);
  const q = projectId === 'all'
    ? query(base, orderBy('createdAt', 'desc'))
    : query(base, where(PROJECT_FIELD, '==', projectId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(firestoreTaskToTask);
};

export const addTask = async (task: Omit<Task, 'id'>, userId: string, projectId: string): Promise<string> => {
  const firestoreTask = taskToFirestoreTask({ ...task, id: '' }, userId, projectId);
  const docRef = await addDoc(collection(db, TASKS_COLLECTION), firestoreTask);
  return docRef.id;
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  const docRef = doc(db, TASKS_COLLECTION, taskId);
  const firestoreUpdates: Record<string, unknown> = {};
  
  // Process updates
  Object.entries(updates).forEach(([key, value]) => {
    if (key === 'assignee') {
      // Special handling for assignee: undefined should delete the field
      if (value === undefined || value === null) {
        firestoreUpdates[key] = null; // Use null to delete field in Firestore
      } else {
        firestoreUpdates[key] = value;
      }
    } else if (value !== undefined) {
      if (key === 'createdAt' && typeof value === 'number') {
        firestoreUpdates[key] = Timestamp.fromMillis(value);
      } else {
        firestoreUpdates[key] = value;
      }
    }
  });
  
  await updateDoc(docRef, firestoreUpdates);
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
};

export const subscribeToTasks = (
  projectId: string,
  callback: (tasks: Task[]) => void
): Unsubscribe => {
  const base = collection(db, TASKS_COLLECTION);
  const q = projectId === 'all'
    ? query(base, orderBy('createdAt', 'desc'))
    : query(base, where(PROJECT_FIELD, '==', projectId), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, 
    (snapshot) => {
      const tasks = snapshot.docs.map(firestoreTaskToTask);
      callback(tasks);
    },
    (error) => {
      console.error('Error in tasks subscription:', error);
    }
  );
};

// People operations
export const getPeople = async (): Promise<string[]> => {
  const q = query(
    collection(db, PEOPLE_COLLECTION),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().name);
};

export const addPerson = async (name: string): Promise<void> => {
  // Check if person already exists to avoid duplicates
  const q = query(
    collection(db, PEOPLE_COLLECTION),
    where('name', '==', name)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    await addDoc(collection(db, PEOPLE_COLLECTION), {
      name,
      createdAt: Timestamp.now(),
    });
    console.log(`✅ Added team member: ${name}`);
  } else {
    console.log(`ℹ️ Team member already exists: ${name}`);
  }
};

export const removePerson = async (name: string): Promise<void> => {
  const q = query(
    collection(db, PEOPLE_COLLECTION),
    where('name', '==', name)
  );
  const snapshot = await getDocs(q);
  
  // Delete all documents with this name (should be just one)
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
};

export const subscribeToPeople = (
  callback: (people: string[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, PEOPLE_COLLECTION),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, 
    (snapshot) => {
      const people = snapshot.docs.map(doc => doc.data().name);
      callback(people);
    },
    (error) => {
      console.error('Error in people subscription:', error);
    }
  );
};

// Projects operations
export interface Project { id: string; name: string }

export const subscribeToProjects = (
  callback: (projects: Project[]) => void
): Unsubscribe => {
  const q = query(collection(db, PROJECTS_COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    interface FirestoreProjectDoc { name: string; createdAt: Timestamp }
    const projects = snapshot.docs.map(d => {
      const data = d.data() as FirestoreProjectDoc;
      return { id: d.id, name: data.name };
    });
    callback(projects);
  });
};

export const addProject = async (name: string): Promise<string> => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Project name required');
  // use name as id (slug)
  const id = trimmed.toLowerCase().replace(/\s+/g, '-');
  const docRef = doc(collection(db, PROJECTS_COLLECTION), id);
  const exists = await getDoc(docRef);
  if (!exists.exists()) {
    await setDoc(docRef, { name: trimmed, createdAt: Timestamp.now() });
  }
  return id;
};