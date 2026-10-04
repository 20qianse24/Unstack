// Register the service worker after the page loads so it can support offline use.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
    });
  });
}

// Keep tasks in memory while this page is open. The type comment describes each task's fields.
/** @type {{ id: number, done: boolean, title: string, description: string | null, priority: string, group: string | null }[]} */
const tasks = []; // an arrray of task objects
// Load tasks from localStorage when the page loads, if any exist
loadTasks();

// Give each new task the next id number, defaults to starting id 1 if no tasks exist yet
let nextTaskId = 1;
if (tasks.length > 0) {
  // can't use nextTaskId = tasks.length since length changes on deletion
  // instead find max id in tasks array and add 1 to it
  // ... is the spread operator, which spreads the array into individual values so Math.max can find the max value
  nextTaskId = Math.max(...tasks.map((task) => task.id)) + 1;
}

// call dialog setups when page first loads
document.addEventListener('DOMContentLoaded', setupTaskOptionsDialog);
document.addEventListener('DOMContentLoaded', setupAddTaskDialog);

// Find the form and list in index.html so this code can respond to the form and update the page.

// querySelectorAll is the browser's API for finding all elements that match a CSS selector, returning a NodeList of matching elements.
// the browser gives you: document, window, navigator, localStorage
const taskForm = document.getElementById('add-task'); // uses the id of the form in index.html to find it
const allTaskList = document.getElementById('all-task-list');
const groupListContainer = document.getElementById('group-list'); // container for group buttons and selected group tasks
const priorityTaskLists = {
  high: document.getElementById('high-priorities-task-list'),
  mid: document.getElementById('mid-priorities-task-list'),
  low: document.getElementById('low-priorities-task-list'),
};
const groupSelect = document.getElementById('group'); //
const newGroupInput = document.getElementById('new-group');
const addNewGroupValue = '__add_new_group__';

// Add event listener to the add task "+" button to open the add task dialog box if clicked.
// added at the top since its always visible unlike dynamic task list items
const addTaskBtn = document.getElementById('new-task');

// if "+" button clicked, show add task pop up dialog box
addTaskBtn.addEventListener('click', () => {
  openAddTask(); // add task needs no parameters
});

let editingTaskId = null; // null = add task, number = edit task
let selectedGroup = null; // the name of the group currently being viewed, null if no group is selected
let searchQuery = ''; // current search text, lowercase; '' means no filter

// Return the unique groups that still have at least one unfinished task.
function getActiveGroupNames() {
  return [...new Set( // create a Set to only store UNIQUE group names from tasks array
    tasks
      .filter((task) => !task.done && task.group) // only keep tasks that are ongoing and have a group name
      .map((task) => task.group)  // return a list of group names that are unique and have at least one unfinished task
  )].sort((first, second) => first.localeCompare(second));  // sort the group names alphabetically
}

// Show group options that belong to ongoing tasks, plus options to skip or add a group.
function renderGroupOptions() {
  const selectedGroup = groupSelect.value;  // remember the user's selection so it can be restored after rebuilding the dropdown
  const activeGroups = getActiveGroupNames();

  groupSelect.replaceChildren();

  // create an <option> for tasks that don't belong to a group, value is empty string so it can be distinguished from the "Add new group..." option
  const noGroupOption = document.createElement('option');
  noGroupOption.value = '';
  noGroupOption.textContent = 'No group';
  groupSelect.append(noGroupOption);  // add the "No group" option to the dropdown

  // create an <option> for each existing group and add it to the dropdown
  activeGroups.forEach((groupName) => {
    const option = document.createElement('option');
    option.value = groupName;
    option.textContent = groupName;
    groupSelect.append(option);
  });

  // create an <option> for adding a new group and add it to the dropdown
  const addGroupOption = document.createElement('option');
  addGroupOption.value = addNewGroupValue;
  addGroupOption.textContent = 'Add new group...';
  groupSelect.append(addGroupOption);

  // Restore the user's selection if it's still valid, otherwise select the "No group" option.
  const validSelections = ['', addNewGroupValue, ...activeGroups];
  // if the selected group is still valid, keep it selected, otherwise (? operator) use the default value of '' (No group) to select the "No group" option
  groupSelect.value = validSelections.includes(selectedGroup) ? selectedGroup : '';
}

// Groups tab view, show group label buttons, or show the selected group's tasks with a way back.
function renderGroupView() {
  const activeGroups = getActiveGroupNames();
  groupListContainer.replaceChildren(); // clear the group list container so it can be rebuilt with the current state of groups and tasks

  // If a group is selected and it still has ongoing tasks, show its tasks with a back button.
  if (selectedGroup && activeGroups.includes(selectedGroup)) {
    // create a <button> to go back to the group list and add it to the page
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.textContent = 'Back to groups';
    backButton.addEventListener('click', () => {
      selectedGroup = null;
      renderGroupView();  // recursively call renderGroupView() to show the group list again
    });

    // Otherwise show the selected group's name and its tasks.
    const heading = document.createElement('h3'); // create h3 heading in html file for the selected group name
    heading.textContent = selectedGroup;  // set the h3 heading text to the selected group name

    // create a <ul> to hold the tasks in the selected group and update html
    const taskList = document.createElement('ul');
    const groupTasks = tasks.filter((task) => task.group === selectedGroup);  // get all tasks that belong to the selected group
    groupListContainer.append(backButton, heading, taskList);
    renderTasks(taskList, groupTasks);  // rendertasks is called before it is defined, but it will be hoisted to the top of the file so it can be used here
    return;
  }

  selectedGroup = null;
  // If no group is selected, show group label buttons for each active group, or a message if there are no active groups.
  if (activeGroups.length === 0) {
    const message = document.createElement('p');
    message.textContent = "No active groups.";
    groupListContainer.append(message);
    return; // if there are no active groups, show a message and return early so the rest of the function doesn't run
  }
  activeGroups.forEach((groupName) => {
    const groupButton = document.createElement('button'); // create a <button> for each group
    const groupNameLabel = document.createElement('span');
    const taskCountLabel = document.createElement('span');  // create new span element in HTML
  
    groupButton.type = 'button';  // set the button type to "button" so it doesn't submit the form when clicked
    groupButton.classList.add('group-button');

    groupNameLabel.textContent = groupName;  // set button text
    taskCountLabel.classList.add('group-task-count'); // add a class to the span element
    // template literal converts no. tasks to string and adds " tasks" for display
    taskCountLabel.textContent = `${tasks.filter((task) => task.group === groupName).length} tasks`;
    groupButton.append(groupNameLabel, taskCountLabel);
    // when the user clicks a group button, set the selectedGroup to that group name and render the group view
    groupButton.addEventListener('click', () => {
      selectedGroup = groupName;
      renderGroupView();  // recursively call renderGroupView() to show the tasks in the selected group
    });
    groupListContainer.append(groupButton); // add new elements to HTML container
  });
}

// Show and require the text field only when the user chooses to add a group.
function updateNewGroupInput() {
  const addingNewGroup = groupSelect.value === addNewGroupValue;  // true if the user selected "Add new group..." from the dropdown
  newGroupInput.hidden = !addingNewGroup; // when not adding a new group, set new group input to hidden
  newGroupInput.disabled = !addingNewGroup; // when not adding a new group, disable the new group input
  newGroupInput.required = addingNewGroup;  // only when adding a new group should you require the new group input 

  if (addingNewGroup) {
    newGroupInput.focus();  // set keybaord focus to the new group input so the user can start typing immediately
  } else {
    newGroupInput.value = ''; // clear the new group input so it doesn't get submitted with the form
    newGroupInput.setCustomValidity('');  // clear any previous validation error so the form can be submitted again
  }
}

// Put the given tasks into the given list on the page.
function renderTasks(taskList, tasksToRender) {
  taskList.replaceChildren(); // clear the task list so it can be rebuilt with the current state of tasks

  // Make one list item for every task in this view.
  // iterate over array of tasks to render and create a list <li> item for each task, then append it to the task list
  tasksToRender.forEach((task) => {
     // store task id and title in a data attribute VARIABLE so it can be used later to identify the task when the user clicks on it
    const listItem = document.createElement('li');

    // set dataset attributes of each task to be referenced when clicking a task
    // NOTE data-* attribute can ONLY hold TEXT/STRINGS (e.g. converts null to "null")
    listItem.dataset.taskId = String(task.id);  // convert int id to string for storage
    listItem.dataset.taskTitle = task.title;

    // don't use these, since null values for optional fields will be stored as literal "null" string in data-*
    /*listItem.dataset.taskDescription = task.description;
    listItem.dataset.taskPriority = task.priority;
    listItem.dataset.taskGroup = task.group;
    listItem.dataset.taskDone = task.done;*/

    // add a "done" class to the list item so it can be styled differently in CSS
    if (task.done) {
      listItem.classList.add('done');
      listItem.style.textDecoration = 'line-through';  // add a line-through style to the task title when it is marked as done
    } else {
      listItem.classList.add('dialog-trigger'); // add a class to the task so it can trigger the dialog box when clicked
    }

    //const label = document.createElement('label');  // create <label> element to hold checkbox and task title
    const doneCheckbox = document.createElement('input'); // create <input> element to hold checkbox for marking task as done
    doneCheckbox.type = 'checkbox'; // set the input type to checkbox (built-in property)
    doneCheckbox.checked = task.done; // set the checkbox state to match the task's current done property (T/F)

    // when user clicks checkbox, do 3 things
    doneCheckbox.addEventListener('change', () => {
      task.done = doneCheckbox.checked; // update the task's done property to match the checkbox state
      renderTaskViews();
      renderGroupOptions();
      saveTasks();
    });

    listItem.addEventListener('click', (event) => {
      if (event.target === doneCheckbox) {  // if the user clicked the checkbox, don't open the dialog box
        return;
      }
      // else open dialog box, passing clicked list item as current target so the dialog box can get the task id and title from its data attributes
      openOptionsDialog({ currentTarget: listItem });
    });

    const taskText = document.createElement('span');
    // $ is js string formatting syntax
    taskText.textContent = ` ${task.title} (${task.priority})`; // add a space before the task title so it doesn't run into the checkbox, and show the task's priority in parentheses
    listItem.append(doneCheckbox, taskText);  // append the checkbox and task title to the list item so they are displayed together

    taskList.append(listItem);  // append the list item to the task list so it is displayed on the page
  });
}

// Return tasks according to global searchQuery filter
function getVisibleTasks() {
  // uses global query const
  if (!searchQuery) return tasks; // no filter, show all tasks (normal view in ALL tab)
  // else, filter for matching tile/description text (search view within ALL tab)
  return tasks.filter((task) =>
    [task.title, task.description ?? '']  // if LHS null, default to RHS=''
      // .some returns a boolean
      .some((text) => text.toLowerCase().includes(searchQuery)) // Checks if any text in the array contains query
  );
}

// Filter the tasks for each tab, then use renderTasks to display each subset.
function renderTaskViews() {
  // allTaskList = global list, getVisibleTasks displays by global query filter
  renderTasks(allTaskList, getVisibleTasks());
  renderGroupView();  // show the group view in the "Groups" tab

  // for each priority level, get the corresponding task list element and filter tasks by that priority
  Object.entries(priorityTaskLists).forEach(([priority, taskList], index) => {
    const priorityTasks = tasks.filter((task) => task.priority === priority); // get all tasks that match the current priority and store in an array
    // display no. tasks in each priority level
    const priorityLabels = document.querySelectorAll(".priority-group-label");  // returns a node list
    // replaced count on each render;
    // // .length is a property not a function (so not .length())
    if (priorityLabels[index]) {  // index is param in forEach loop, indices in node list
      // '${}' is like f string formatting
      priorityLabels[index].textContent += `${priorityTasks.length} tasks`;
    }
    // pass the array of tasks to renderTasks() to display them in the corresponding priority list
    renderTasks(taskList, priorityTasks);
  });
}

// Update the new group input field whenever the user changes the group selection.
groupSelect.addEventListener('change', updateNewGroupInput);  // i.e. call function updateNewGroupInput() whenever the user changes the group selection in the dropdown
newGroupInput.addEventListener('input', () => newGroupInput.setCustomValidity('')); // attach custom error message in HTML

// actually CALLING functions to render page when it first loads, so user sees current state of tasks and groups.
renderGroupOptions();
renderTaskViews();
updateNewGroupInput();
saveTasks();

// Run this function whenever the user submits the task form.
// use editingTaskId as a FLAG for EDIT or ADD form type
taskForm.addEventListener('submit', (event) => {
  // Stop the browser from reloading the page when the form is submitted.
  event.preventDefault();

  // READ + VALIDATE
  // Read the values entered in the form by their name attributes.
  const formData = new FormData(taskForm);
  // Safely extract the string and fallback to an empty string if empty
  // Uses Logical OR (||): Using || instead of ?? checks for all falsy values.
  // If formData.get() returns null, undefined, or an empty string "", it immediately swaps it for your fallback ''
  const description = (formData.get('description') || '').toString().trim();
  const groupName = groupSelect.value === addNewGroupValue
    ? newGroupInput.value.trim()  // if the user selected "Add new group...", use the value from the new group input, otherwise use the value from the group dropdown
    : groupSelect.value;

  // Validate the new group name if the user selected "Add new group..." and didn't enter a name or entered the placeholder text
  if (groupSelect.value === addNewGroupValue && (!groupName || groupName === addNewGroupValue)) {
    newGroupInput.setCustomValidity('Enter a valid group name.');
    newGroupInput.reportValidity();
    return;
  }

  // BRANCH into EDIT or ADD
  if (editingTaskId !== null) {
    // EDIT branch: find the existing task and overwrite its fields
    const taskToEdit = tasks.find((task) => task.id === editingTaskId);
    if (taskToEdit) {
      // get updated data from form inputs
      taskToEdit.title = String(formData.get('title') ?? '').trim();
      taskToEdit.description = description || null;
      taskToEdit.priority = formData.get('priority');
      taskToEdit.group = groupName || null;
    } 
  } else {  // ADD branch: else push new task and increment id as usual
    // Create the task OBJECT, filling fields that do not have form inputs with defaults.
    const task = {
      id: nextTaskId,
      done: false,
      title: String(formData.get('title') ?? '').trim(),
      description: description || null, // null if no form input provided
      priority: formData.get('priority'),
      group: groupName || null, // null if no form input provided
    };

    // Advance the id number and save the task in the in-memory array.
    nextTaskId += 1;
    tasks.push(task);
    }
  // SHARED BEHAVIOUR in ADD and EDIT
  saveTasks()
  renderTaskViews();
  renderGroupOptions();
  document.getElementById('add-task-dialog').close();
});


// Dynamic tab switching, default to "All" tab if no tab is active.
// Listen for clicks on the tab buttons and switch the visible tab.

// Find the tab buttons and task tabs in index.html to respond to buttons and update page.
const tabButtons = document.querySelectorAll('.tab-buttons button[data-tab]');  // get all buttons with class .tab-buttons and data-tab attribute
const taskTabs = document.querySelectorAll('.task-tab');
function showTab(button) 
{
  const targetTabId = button.dataset.tab; // Get id of tab to make visible from button's data-tab attribute
  const targetTab = document.getElementById(targetTabId);

  taskTabs.forEach((tab) => {
    tab.hidden = (tab !== targetTab); // when tab is not the target tab, set tab to hidden, otherwise show it
  });
  tabButtons.forEach((tabButton) => {
    // .toggle adds it if missing, removes it if present
    // add '.active' class to the clicked <button> to display and remove it from others to hide (modify html)
    tabButton.classList.toggle('active', tabButton === button);
  });
}

// Add click event listeners to each tab button to show the corresponding tab when clicked.
// tabButtons is a NodeList, which is not an array, so we use forEach() to iterate over it and add an event listener to each button.
tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showTab(button);
  });
});

// Show the active tab if one is already active, otherwise show the "All" (1st) tab by default.
// ... means "spread" the NodeList into an array i.e. [...tabButtons] is equivalent to Array.from(tabButtons)
const activeTabButton = [...tabButtons].find((button) => button.classList.contains('active')) ?? tabButtons[0];
if (activeTabButton) showTab(activeTabButton);

// Persist tasks in localStorage with JSON so they survive page reloads.
// Save entire array at once under a single master key 'tasks', instead of saving each task individually
// JSON.stringify converts the tasks array into a JSON string so it can be stored in localStorage
// each time task list is updated, task array stored under 'tasks' key is replaced with updated version
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Load tasks from localStorage when the page loads, if any exist
function loadTasks() {
  const savedTasks = localStorage.getItem('tasks');
  // if there are saved tasks, parse the JSON string back into an array of task objects and push them into the tasks array
  if (savedTasks) {
    const parsedTasks = JSON.parse(savedTasks);
    // spread operator ... is used to push each task object into the tasks array 
    tasks.push(...parsedTasks);  // i.e. tasks.push(task1, task2, task3, ...)
  }
}

// Define a SETUP function for dialog box to edit or delete a task when the user clicks on it.
function setupTaskOptionsDialog() {
  const taskOptions = document.getElementById('task-options');
  const closeButton = document.getElementById('close-window');
  const deleteButton = document.getElementById('delete-btn');
  const editButton = document.getElementById('edit-btn');

  // If any of the elements are missing, don't set up the dialog box.
  if (!taskOptions || !closeButton || !deleteButton || !editButton) {
    return;
  }

  // Add event listeners to the buttons in the dialog box to close or delete or edit the task.
  closeButton.addEventListener('click', () => {
    taskOptions.close();
  });

  // delete task logic
  deleteButton.addEventListener('click', () => {
    // Get the task id from the dialog box's data attribute and convert it to a number.
    const currTaskId = Number(taskOptions.dataset.taskId);
    // If the task id is not a valid number, do nothing.
    if (!Number.isInteger(currTaskId)) {
      return;
    }
    // Ask the user to confirm the deletion of the task. If they cancel, do nothing.
    const confirmed = window.confirm('Delete this task? Cannot be undone.');  // browser built-in confirm window
    if (!confirmed) {
      return;
    }
    // Find the index of the task in the tasks array by its id.
    const currTaskIndex = tasks.findIndex((task) => task.id === currTaskId);
    // If the task is not found, do nothing.
    if (currTaskIndex === -1) {
      taskOptions.close();
      return;
    }

    tasks.splice(currTaskIndex, 1); // remove the 1 deleted task from the tasks array

    saveTasks();
    renderTaskViews();
    renderGroupOptions();
    taskOptions.close();  // close the dialog box after deleting the task
  });

  // edit task logic
  editButton.addEventListener('click', () => {
    // close current pop up and open edit task view
    const currTaskId = Number(taskOptions.dataset.taskId);
    taskOptions.close();  // close AFTER getting currTaskId so it can be used in openAddTask()
    // If the task id is not a valid number, do nothing.
    if (!Number.isInteger(currTaskId)) {
      return;
    }
    openAddTask(currTaskId); // set current task id to flag edit capability
  });
}

// Open the dialog box when the user clicks on a task, and populate it with the task's title and id.
function openOptionsDialog(event) {
  const taskOptions = document.getElementById('task-options');
  const clickedTaskTitle = document.getElementById('clicked-task-title');
  const clickedTaskDescription = document.getElementById('clicked-task-description');
  const clickedTaskGroup = document.getElementById('clicked-task-group');
  // If any of the required elements are missing, do nothing.
  if (!taskOptions || !clickedTaskTitle) {
    return;
  }

  // set visible text
  clickedTaskTitle.textContent = event.currentTarget.dataset.taskTitle;

  // Use stored id of current task in data attribute to get description (event is current task)
  const currTaskId = Number(event.currentTarget.dataset.taskId);  // convert id back into int from string in data- attribute storage
  const currTask = tasks.find((task) => task.id === currTaskId);  // search global array with id to get task object
  if (currTask === undefined) return;

  const taskDesc = currTask.description;  // this avoids a null value being converted to a string from running it through data- attribute
  const taskGroup = currTask.group;
  console.log('desc:', taskDesc, 'for', currTask);
  // do not show null if there is no description
  if ( taskDesc === null || taskDesc == '') {
    clickedTaskDescription.style.display = "none";
    clickedTaskDescription.textContent = '';
  } else {  // only set description text if not empty
    clickedTaskDescription.style.display = '';  // undo previous hide styles
    clickedTaskDescription.textContent = taskDesc;
  }

  // do not show null if there is no group label
  if ( taskGroup === null || taskGroup == '') {
    clickedTaskGroup.style.display = "none";
    clickedTaskGroup.textContent = '';
  } else {  // only set description text if not empty
    clickedTaskGroup.style.display = '';  // undo previous hide styles
    clickedTaskGroup.textContent = taskGroup;
  }
  // data attribute was defined in renderTasks() when the list item was created, so it can be used here to identify the task when the user clicks on it
  taskOptions.dataset.taskId = event.currentTarget.dataset.taskId;  // store task id in dialog box's data attribute so it can be used later to identify the task when the user clicks on it
  taskOptions.showModal();
}

// Setup function for add task dialog box, which is called when the page first loads.
function setupAddTaskDialog() {
  const addTaskWindow = document.getElementById("add-task-dialog");
  const closeAddTask = document.getElementById('close-add-task');
  if (!addTaskWindow || !closeAddTask) {
    return;
  }

  closeAddTask.addEventListener('click', () => {
    addTaskWindow.close();
  });
}

// Open the dialog box when the user clicks on add task "+" button
// parameter currTask is only used when user wants to edit
function openAddTask(currTaskId = null) {
  const addTask = document.getElementById('add-task-dialog');
  const submitButton = document.getElementById('submit-btn');
  const formTitle = document.getElementById('add/edit-form-title');

  if (currTaskId !== null) {  // make edit task dynamic changes to form
    // search gloabl task list for matching id to current task id
    const currTask = tasks.find((task) => task.id === currTaskId);
    if (currTask === undefined) return;

    editingTaskId = currTaskId; // set global flag for EDIT branch
    submitButton.textContent = 'Save Changes';
    formTitle.textContent = 'Edit Task';

    renderGroupOptions();         // so the group option exists before selecting it
    // set input fields to current task info
    document.getElementById('title').value = currTask.title;
    // set to '' null if no input provided
    document.getElementById('description').value = currTask.description ?? '';
    document.getElementById('priority').value = currTask.priority;
    groupSelect.value = currTask.group ?? '';
  } else {
    editingTaskId = null; // set global flag to ADD task branch
    taskForm.reset();
    renderGroupOptions();
    groupSelect.value = '';
    submitButton.textContent = 'Add Task';
    formTitle.textContent = 'Add Task';
  }

  updateNewGroupInput();
  // open pop up and set keyboard directly to first input field
  addTask.showModal();
  document.getElementById('title').focus();
}

// search functionality
const toggleSearchBtn = document.getElementById('toggle-search');
const searchBox = document.getElementById('search');
const searchInput = document.getElementById('search-input');

// Clicking the icon opens or closes the search box.
toggleSearchBtn.addEventListener('click', () => {
  searchBox.classList.toggle('open'); // dynamically add or remove class label 'open'

  if (searchBox.classList.contains('open')) {
    searchBox.style.display = ''; // i.e. style="display:none" is inline CSS
    showTab(tabButtons[0]);   // always go to All tab as soon as search opens
    searchInput.focus();
  } else {
    // closing search: clear the filter and show every task again
    searchInput.value = '';
    searchQuery = ''; // reset global const/filter
    searchBox.style.display = 'none';
    showTab(tabButtons[0]);
    renderTaskViews();
  }
});

// Filter LIVE as the user types using event 'input' (doesn't require submission)
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase(); // set global query/filter const
  showTab(tabButtons[0]); // make sure user is on ALL tab view
  renderTaskViews();
});