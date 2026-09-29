// Register the service worker after the page loads so it can support offline use.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

// Keep tasks in memory while this page is open. The type comment describes each task's fields.
/** @type {{ id: number, done: boolean, title: string, description: string | null, priority: string, group: string | null }[]} */
const tasks = [];

// Give each new task the next id number, starting at 1.
let nextTaskId = 1;

// Find the form and list in index.html so this code can respond to the form and update the page.
const taskForm = document.querySelector('#add-task');
const taskList = document.querySelector('#task-list');
const groupSelect = document.querySelector('#group');
const newGroupInput = document.querySelector('#new-group');
const addNewGroupValue = '__add_new_group__';

// Show groups that belong to unfinished tasks, plus options to skip or add a group.
function renderGroupOptions() {
  const selectedGroup = groupSelect.value;  // remember the user's selection so it can be restored after rebuilding the dropdown
  // Use a Set to get unique group names, then sort them alphabetically.
  const activeGroups = [...new Set( tasks
      .filter((task) => !task.done && task.group)
      .map((task) => task.group)  // get the group name of each unfinished task
  )].sort((first, second) => first.localeCompare(second));

  groupSelect.replaceChildren();

  // create an option for tasks that don't belong to a group, value is emmpty string so it can be distinguished from the "Add new group..." option
  const noGroupOption = document.createElement('option');
  noGroupOption.value = '';
  noGroupOption.textContent = 'No group';
  groupSelect.append(noGroupOption);  // add the "No group" option to the dropdown

  activeGroups.forEach((groupName) => {
    const option = document.createElement('option');
    option.value = groupName;
    option.textContent = groupName;
    groupSelect.append(option);
  });

  const addGroupOption = document.createElement('option');
  addGroupOption.value = addNewGroupValue;
  addGroupOption.textContent = 'Add new group...';
  groupSelect.append(addGroupOption);

  const validSelections = ['', addNewGroupValue, ...activeGroups];
  groupSelect.value = validSelections.includes(selectedGroup) ? selectedGroup : '';
}

// Show and require the text field only when the user chooses to add a group.
function updateNewGroupInput() {
  const addingNewGroup = groupSelect.value === addNewGroupValue;  // true if the user selected "Add new group..." from the dropdown
  newGroupInput.hidden = !addingNewGroup; // hide the new group input when not adding a new group
  newGroupInput.disabled = !addingNewGroup; // disable the new group input when not adding a new group so it doesn't get submitted with the form
  newGroupInput.required = addingNewGroup;  // require the new group input only when adding a new group so the form can be submitted without it

  if (addingNewGroup) {
    newGroupInput.focus();  // set keybaord focus to the new group input so the user can start typing immediately
  } else {
    newGroupInput.value = ''; // clear the new group input so it doesn't get submitted with the form
    newGroupInput.setCustomValidity('');  // clear any previous validation error so the form can be submitted again
  }
}

// Rebuild the visible task list from the current task data.
function renderTasks() {
  taskList.replaceChildren();

  tasks.forEach((task) => {
    const listItem = document.createElement('li');
    listItem.dataset.taskId = String(task.id);

    const label = document.createElement('label');
    const doneCheckbox = document.createElement('input');
    doneCheckbox.type = 'checkbox';
    doneCheckbox.checked = task.done;
    doneCheckbox.addEventListener('change', () => {
      task.done = doneCheckbox.checked;
      renderTasks();
      renderGroupOptions();
    });

    label.append(doneCheckbox, document.createTextNode(` ${task.title} (${task.priority})`));
    listItem.append(label);

    taskList.append(listItem);
  });
}

// Update the new group input field whenever the user changes the group selection.
groupSelect.addEventListener('change', updateNewGroupInput);
newGroupInput.addEventListener('input', () => newGroupInput.setCustomValidity(''));

renderGroupOptions();
renderTasks();
updateNewGroupInput();

// Run this function whenever the user submits the task form.
taskForm.addEventListener('submit', (event) => {
  // Stop the browser from reloading the page when the form is submitted.
  event.preventDefault();

  // Read the values entered in the form by their name attributes.
  const formData = new FormData(taskForm);
  const description = String(formData.get('description') ?? '').trim();
  const groupName = groupSelect.value === addNewGroupValue
    ? newGroupInput.value.trim()
    : groupSelect.value;

  // Validate the new group name if the user selected "Add new group..." and didn't enter a name or entered the placeholder text
  if (groupSelect.value === addNewGroupValue && (!groupName || groupName === addNewGroupValue)) {
    newGroupInput.setCustomValidity('Enter a valid group name.');
    newGroupInput.reportValidity();
    return;
  }

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

  renderTasks();
  renderGroupOptions();

  // Clear the inputs so the form is ready for another task.
  taskForm.reset();
  updateNewGroupInput();
});


// Dynamic tab switching, default to "All" tab if no tab is active.
// Listen for clicks on the tab buttons and switch the visible tab.

// Find the tab buttons and task tabs in index.html to respond to buttons and update page.
const tabButtons = document.querySelectorAll('.tab-buttons button[data-tab]');
const taskTabs = document.querySelectorAll('.task-tab');

function showTab(button) {
  const targetTabId = button.dataset.tab; // Get id of tab to /make visible from button's data-tab attribute
  const targetTab = document.getElementById(targetTabId);

  taskTabs.forEach((tab) => {
    tab.hidden = tab !== targetTab; // hide all tabs except the one that matches the button's data-tab
  });
  tabButtons.forEach((tabButton) => {
    tabButton.classList.toggle('active', tabButton === button); // add 'active' class to the clicked button and remove it from others
  });
}

// Add click event listeners to each tab button to show the corresponding tab when clicked.
tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showTab(button);
  });
});

const activeTabButton = [...tabButtons].find((button) => button.classList.contains('active')) ?? tabButtons[0];
if (activeTabButton) showTab(activeTabButton);