I would like the ability to add a new client from the project creation dashboard,
instead of having to click over into the Clients tab, create one, and then come back.

Get rid of "spent so far" in project creation and "progress" in Phase creation. If someone needs to retroactively put spend on a project, they can do so in the expense tab.

Still hoping for "expected work done by month"

as a percentage in project/phase creation to calculate burn rate against, I believe we spoke about this. Let me know what is possible.

The total project budget should add the budgets at every level (project, phase, subphase, etc) for a total budget. Right now it is only pulling the project budget.

Copy changes
"Agency slug" -> "Agency handle"
"Take control of your money" -> "The project tracker for small but mighty teams"
"Smart budgeting for real life — track, plan, and grow." -> "Everything you need to stay profitable, and nothing you don't."

=====================================================================================================

TASK 1
"Agency slug" -> "Agency handle" DONE

TASK 2
"Take control of your money" -> "The project tracker for small but mighty teams" DONE

TASK 3
"Smart budgeting for real life — track, plan, and grow." -> "Everything you need to stay profitable, and nothing you don't." DONE

TASK 4
I would like the ability to add a new client from the project creation dashboard,
instead of having to click over into the Clients tab, create one, and then come back.

TASK 5
Get rid of "spent so far" in project creation and "progress" in Phase creation. If someone needs to retroactively put spend on a project, they can do so in the expense tab.

Hi Sachin,

Following my discussion with Ashish, I have outlined my understanding of the client's updated requirements below. Could you please review this (and verify with the client if necessary) to confirm we are fully aligned before I proceed with the implementation?

**My Understanding of the Tasks:**
1. **Inline Creation:** Add "Create Client", "Create Team", and "Create Team Member" shortcut buttons directly inside the project/phase creation and update modals.
2. **Remove Manual Progress/Spend:** Delete the "Spent so far" and "Progress" input fields from project/phase creation. Actual spend will be logged via the Expenses tab.
3. **Total Budget Roll-up:** The displayed Total Project Budget should automatically sum up the top-level project budget plus the budgets of all its phases/subphases.

**Needs Confirmation on Exact Implementation from Client:**
* **Expected work done by month:** My understanding is that we will replace the manual "Progress" input with a new "Expected work done by month (%)" field in both the database and UI. This percentage will be used to automatically calculate the target burn rate (e.g., if a project budget is $10,000 and the expected work is 25%/month, the system expects a $2,500/month burn rate). Please confirm if this is the exact logic the client expects before I build it.
