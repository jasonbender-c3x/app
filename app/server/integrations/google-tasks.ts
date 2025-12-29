/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GOOGLE TASKS INTEGRATION MODULE                        ║
 * ║                    Meowstik - Task Management                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Google Tasks API v1 for task management.
 * It enables the application to create, read, update, and delete tasks and
 * task lists in the user's Google Tasks account.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  TASK HIERARCHY                                                             │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   ┌─────────────────────────────────────────────────────────────┐          │
 * │   │  Task Lists (containers for tasks)                          │          │
 * │   │  └── Task List "Work"                                       │          │
 * │   │        └── Task: "Finish report"                            │          │
 * │   │        └── Task: "Review PR"                                │          │
 * │   │        └── Task: "Team meeting notes"                       │          │
 * │   │  └── Task List "Personal"                                   │          │
 * │   │        └── Task: "Buy groceries"                            │          │
 * │   │        └── Task: "Call mom"                                 │          │
 * │   └─────────────────────────────────────────────────────────────┘          │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * TASK PROPERTIES:
 * - id: Unique task identifier
 * - title: Task title/name
 * - notes: Detailed description or notes
 * - due: Due date (RFC 3339 format, date portion only)
 * - status: "needsAction" or "completed"
 * - completed: Completion timestamp (when status is "completed")
 * 
 * SPECIAL IDs:
 * - "@default": The user's default task list
 * 
 * NOTE: This integration uses the Google Calendar connector for authentication
 * because Google Tasks shares OAuth scopes with Calendar in Replit Connectors.
 * 
 * AVAILABLE OPERATIONS:
 * Task Lists:
 * - listTaskLists: Get all task lists
 * - getTaskList: Get a specific task list
 * - createTaskList: Create a new task list
 * - deleteTaskList: Delete a task list
 * 
 * Tasks:
 * - listTasks: Get tasks in a list
 * - getTask: Get a specific task
 * - createTask: Create a new task
 * - updateTask: Update task properties
 * - completeTask: Mark task as completed
 * - uncompleteTask: Mark task as needing action
 * - deleteTask: Delete a task
 * - clearCompletedTasks: Remove all completed tasks from a list
 * 
 * @module google-tasks
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/tasks/reference/rest
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google APIs client library.
 * Provides access to all Google API services including Tasks.
 */
import { google } from 'googleapis';
import { getAuthenticatedClient, isAuthenticated } from './google-auth';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a fresh Google Tasks API client with current credentials.
 * Uses custom OAuth2 authentication via google-auth module.
 * 
 * @async
 * @returns {Promise<tasks_v1.Tasks>} Authenticated Tasks API client
 * @throws {Error} If not authenticated with Google
 * 
 * @example
 * const tasks = await getUncachableGoogleTasksClient();
 * const taskLists = await tasks.tasklists.list();
 */
export async function getUncachableGoogleTasksClient() {
  const auth = await getAuthenticatedClient();
  return google.tasks({ version: 'v1', auth });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: TASK LIST OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists all task lists for the authenticated user.
 * 
 * Every Google account has at least one default task list.
 * Returns an array of task list metadata objects.
 * 
 * @async
 * @returns {Promise<tasks_v1.Schema$TaskList[]>} Array of task list objects
 *   - id: Task list identifier
 *   - title: Task list name
 *   - updated: Last modification time
 * 
 * @example
 * const taskLists = await listTaskLists();
 * taskLists.forEach(list => console.log(list.title));
 */
export async function listTaskLists() {
  const tasks = await getUncachableGoogleTasksClient();
  
  const response = await tasks.tasklists.list({
    maxResults: 20  // Limit number of results
  });
  
  return response.data.items || [];
}

/**
 * Retrieves a specific task list by ID.
 * 
 * @async
 * @param {string} taskListId - Task list ID (or "@default" for default list)
 * @returns {Promise<tasks_v1.Schema$TaskList>} Task list object
 * @throws {Error} If task list not found
 * 
 * @example
 * const list = await getTaskList('MTIzNDU2Nzg5');
 * console.log('List title:', list.title);
 */
export async function getTaskList(taskListId: string) {
  const tasks = await getUncachableGoogleTasksClient();
  
  const response = await tasks.tasklists.get({
    tasklist: taskListId
  });
  
  return response.data;
}

/**
 * Creates a new task list.
 * 
 * @async
 * @param {string} title - Name for the new task list
 * @returns {Promise<tasks_v1.Schema$TaskList>} Created task list object
 * 
 * @example
 * const newList = await createTaskList('Shopping');
 * console.log('Created list:', newList.id);
 */
export async function createTaskList(title: string) {
  const tasks = await getUncachableGoogleTasksClient();
  
  const response = await tasks.tasklists.insert({
    requestBody: {
      title
    }
  });
  
  return response.data;
}

/**
 * Deletes a task list and all its tasks.
 * 
 * WARNING: This is permanent and cannot be undone.
 * All tasks in the list are also deleted.
 * 
 * @async
 * @param {string} taskListId - Task list ID to delete
 * @returns {Promise<{success: boolean}>} Success indicator
 * @throws {Error} If task list not found or deletion fails
 * 
 * @example
 * await deleteTaskList('MTIzNDU2Nzg5');
 */
export async function deleteTaskList(taskListId: string) {
  const tasks = await getUncachableGoogleTasksClient();
  
  await tasks.tasklists.delete({
    tasklist: taskListId
  });
  
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: TASK LISTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists all tasks in a task list.
 * 
 * By default, includes both completed and incomplete tasks.
 * Use showCompleted=false to hide completed tasks.
 * 
 * @async
 * @param {string} [taskListId='@default'] - Task list to query
 * @param {boolean} [showCompleted=true] - Include completed tasks
 * @param {number} [maxResults=100] - Maximum tasks to return
 * @returns {Promise<tasks_v1.Schema$Task[]>} Array of task objects
 * 
 * @example
 * // Get all tasks from default list
 * const tasks = await listTasks();
 * 
 * @example
 * // Get only incomplete tasks
 * const incomplete = await listTasks('list123', false);
 */
export async function listTasks(taskListId: string = '@default', showCompleted = true, maxResults = 100) {
  const tasks = await getUncachableGoogleTasksClient();
  
  const response = await tasks.tasks.list({
    tasklist: taskListId,
    showCompleted,  // Whether to include completed tasks
    maxResults
  });
  
  return response.data.items || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: TASK RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves a specific task by ID.
 * 
 * Returns the full task object including all properties.
 * 
 * @async
 * @param {string} taskListId - Task list containing the task
 * @param {string} taskId - Task ID to retrieve
 * @returns {Promise<tasks_v1.Schema$Task>} Task object
 * @throws {Error} If task not found
 * 
 * @example
 * const task = await getTask('list123', 'task456');
 * console.log(task.title, task.status);
 */
export async function getTask(taskListId: string, taskId: string) {
  const tasks = await getUncachableGoogleTasksClient();
  
  const response = await tasks.tasks.get({
    tasklist: taskListId,
    task: taskId
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: TASK CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a new task in a task list.
 * 
 * DUE DATE FORMAT:
 * The due date should be in RFC 3339 format with the date portion only.
 * Example: "2025-01-15T00:00:00.000Z"
 * 
 * @async
 * @param {string} taskListId - Task list to add task to
 * @param {string} title - Task title
 * @param {string} [notes] - Optional detailed notes
 * @param {string} [due] - Optional due date (RFC 3339)
 * @returns {Promise<tasks_v1.Schema$Task>} Created task object
 * 
 * @example
 * // Create a simple task
 * const task = await createTask('list123', 'Buy milk');
 * 
 * @example
 * // Create a task with notes and due date
 * const task = await createTask(
 *   'list123',
 *   'Submit report',
 *   'Q4 financial summary',
 *   '2025-01-31T00:00:00.000Z'
 * );
 */
export async function createTask(
  taskListId: string,
  title: string,
  notes?: string,
  due?: string
) {
  const tasks = await getUncachableGoogleTasksClient();
  
  const response = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: {
      title,
      notes,
      due
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: TASK MODIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates a task's properties.
 * 
 * Uses PATCH semantics - only provided fields are updated.
 * 
 * STATUS VALUES:
 * - "needsAction": Task is incomplete
 * - "completed": Task is done
 * 
 * @async
 * @param {string} taskListId - Task list containing the task
 * @param {string} taskId - Task to update
 * @param {Object} updates - Fields to update
 * @param {string} [updates.title] - New task title
 * @param {string} [updates.notes] - New notes
 * @param {string} [updates.due] - New due date
 * @param {string} [updates.status] - New status
 * @returns {Promise<tasks_v1.Schema$Task>} Updated task object
 * 
 * @example
 * // Update task title and add notes
 * const updated = await updateTask('list123', 'task456', {
 *   title: 'Updated task title',
 *   notes: 'Added some notes'
 * });
 */
export async function updateTask(
  taskListId: string,
  taskId: string,
  updates: {
    title?: string;
    notes?: string;
    due?: string;
    status?: 'needsAction' | 'completed';
  }
) {
  const tasks = await getUncachableGoogleTasksClient();
  
  // Use patch for partial updates
  const response = await tasks.tasks.patch({
    tasklist: taskListId,
    task: taskId,
    requestBody: updates
  });
  
  return response.data;
}

/**
 * Marks a task as completed.
 * 
 * Convenience wrapper around updateTask that sets status to "completed".
 * 
 * @async
 * @param {string} taskListId - Task list containing the task
 * @param {string} taskId - Task to complete
 * @returns {Promise<tasks_v1.Schema$Task>} Updated task object
 * 
 * @example
 * const completed = await completeTask('list123', 'task456');
 * console.log('Completed at:', completed.completed);
 */
export async function completeTask(taskListId: string, taskId: string) {
  return updateTask(taskListId, taskId, { status: 'completed' });
}

/**
 * Marks a task as incomplete (needing action).
 * 
 * Convenience wrapper around updateTask that sets status to "needsAction".
 * This can be used to "uncomplete" a task that was marked done.
 * 
 * @async
 * @param {string} taskListId - Task list containing the task
 * @param {string} taskId - Task to uncomplete
 * @returns {Promise<tasks_v1.Schema$Task>} Updated task object
 * 
 * @example
 * // Reopen a completed task
 * await uncompleteTask('list123', 'task456');
 */
export async function uncompleteTask(taskListId: string, taskId: string) {
  return updateTask(taskListId, taskId, { status: 'needsAction' });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: TASK DELETION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deletes a task from a task list.
 * 
 * This permanently removes the task and cannot be undone.
 * 
 * @async
 * @param {string} taskListId - Task list containing the task
 * @param {string} taskId - Task to delete
 * @returns {Promise<{success: boolean}>} Success indicator
 * @throws {Error} If task not found or deletion fails
 * 
 * @example
 * await deleteTask('list123', 'task456');
 */
export async function deleteTask(taskListId: string, taskId: string) {
  const tasks = await getUncachableGoogleTasksClient();
  
  await tasks.tasks.delete({
    tasklist: taskListId,
    task: taskId
  });
  
  return { success: true };
}

/**
 * Clears all completed tasks from a task list.
 * 
 * This is a bulk operation that removes all tasks with
 * status "completed". Incomplete tasks are not affected.
 * 
 * Useful for cleaning up after completing a set of tasks.
 * 
 * @async
 * @param {string} taskListId - Task list to clear
 * @returns {Promise<{success: boolean}>} Success indicator
 * 
 * @example
 * // Remove all completed tasks from the list
 * await clearCompletedTasks('list123');
 */
export async function clearCompletedTasks(taskListId: string) {
  const tasks = await getUncachableGoogleTasksClient();
  
  // Clear operation removes all completed tasks
  await tasks.tasks.clear({
    tasklist: taskListId
  });
  
  return { success: true };
}
