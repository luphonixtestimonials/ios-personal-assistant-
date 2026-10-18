
Here is a complete testing guide with copy-pasteable `curl` commands to test the full task workflow (Create, Check, Complete, and Verify).

---

### Setup Variable (PowerShell)

You can store your API URL and Token in variables so you don't have to retype them:

```powershell
$BASE_URL = "https://luphonix-web.vercel.app"
$API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkYzk5M2U4ZC1kM2U0LTQyZDItYWUwNS05YWI0YTMwYjFkN2UiLCJlbWFpbCI6InRlc3RfMTc5MTkwNTc3Mzk0MkBsdXBob25peC5hcHAiLCJpc1dlYmhvb2siOnRydWUsImlhdCI6MTc5MjA1Njg0NiwiZXhwIjoyMTA3NDE2ODQ2fQ.71vb9niNd4esr6I-BH3dagqRDh3xkujIT49G0TOqL_g"
```

---

### 1. Check Remaining Pending Tasks (What Siri Reads)

Tests the Siri query to see all active pending tasks:

```powershell
curl -i "$BASE_URL/api/tasks?filter=today&format=text&apiKey=$API_KEY"
```

**Expected Response:**

```text
You have 1 task: Meeting with shreya.
```

To view the raw JSON data of all tasks:

```powershell
curl -i "$BASE_URL/api/tasks?filter=today&format=json&apiKey=$API_KEY"
```

---

### 2. Add a New Task via Siri Voice / URL

Simulates Siri saying *"Siri, add a task to study physics in Luphonix"*:

```powershell
curl -i "$BASE_URL/api/tasks/add?title=Study%20Physics&format=text&apiKey=$API_KEY"
```

**Expected Response:**

```text
Added "Study Physics" to your Luphonix tasks.
```

---

### 3. Mark a Task as Completed (Siri Voice Trigger)

Simulates Siri saying *"Siri, mark study physics as completed in Luphonix"*. You can pass any part of the task title (`title=study` or `title=Meeting`):

```powershell
curl -i "$BASE_URL/api/tasks/complete?title=Meeting&format=text&apiKey=$API_KEY"
```

**Expected Response:**

```text
Marked 'Meeting with shreya' as completed in Luphonix. Good job!
```

Or for JSON output with task details:

```powershell
curl -i "$BASE_URL/api/tasks/complete?title=Meeting&format=json&apiKey=$API_KEY"
```

---

### 4. Verify Siri Recognizes It as Completed

Run the check query again:

```powershell
curl -i "$BASE_URL/api/tasks?filter=today&format=text&apiKey=$API_KEY"
```

**Expected Response:**

```text
You have no remaining tasks for today in Luphonix!
```

*(Notice the completed task is automatically excluded from Siri's readout!)*

---

### 5. Mark Completed Using `PATCH` with JSON Body

If you prefer testing with standard REST JSON payloads via `Authorization: Bearer`:

```powershell
# Replace <TASK_ID> with your task's ID:
curl -i -X PATCH "$BASE_URL/api/tasks/<TASK_ID>" `
  -H "Authorization: Bearer $API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"is_completed": true}'
```

---

### 6. Delete a Task

```powershell
curl -i -X DELETE "$BASE_URL/api/tasks/<TASK_ID>" `
  -H "Authorization: Bearer $API_KEY"
```
