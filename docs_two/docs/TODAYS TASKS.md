Jul 8
In the create new project in the milstone phase after filling Description for the milstone and in then in the list of milestone the text exceds in teh box no wrap and there is overflow.

2 In the budget items section where we have a the budget name when we go to the next section Review and confirm in the budget items section name naem is again overflowign and not wraping.

3 In the provided project detail sidebar phase tab the theme is not working properly in dark theme.

4 In the milstone section after adding milestone the discription overflows typical issue.

5 the milstone section of the project detail sidebar the name is overflowing.

6 All red color \* on every required field and a logical text character input lenght limit and a charater use count like current character count / limit of count and after that show error and also dont let them edit so like for eg if they try to hack there way past the input form by some messure later they will get caust by the input leght check and will be shown erro adn also make sure to disable the procedd buton till there is an error and also till or all req fields not filled.

7 in the archive and activate project modal the text is same change it to appropriate one

8 the view in the table view of the project in dark mode is not matching the theme and is wrong fix the bg color and text color according to the dark or light theme.

9 in the manage team section the team name is overflowing in the Teams Management
Review team ownership, focus areas, and staffing groups across the workspace. section the name is overflwoign tooo

10 again add validation and what i told.

11 make the deltete messasge appropriate like archive and activate.

12 when the code is wrong it shows wrong error.

TICKETS

WADE-117

Assigned Role Permissions Are Not Applied for Team Member After Login

Done

Description

Role permissions assigned to a Team Member are not being enforced after login. Although the required permission (e.g., Delete Member) is enabled in the assigned role, the corresponding functionality is not available when logged in as that Team Member.

Steps to Reproduce
Log in as an Admin.

Navigate to Roles & Permissions.

Edit or create a Team Member role.

Enable the Delete Member permission and save the changes.

Assign this role to a Team Member.

Log out from the Admin account.

Log in using the Team Member account.

Navigate to the Team Members section.

Observe the available actions for team members.

Expected Result
The Team Member should have access to all actions permitted by the assigned role, including the Delete Member option.

Add epic

WADE-116

"Save as Draft" Remains in Processing State After Expense Is Successfully Submitted for Approval

Done
Description

When an expense is submitted using the Save for Approval action, the Save as Draft button also enters a processing/loading state. This creates misleading UI behavior, as only the selected action should display the loading indicator.

Preconditions
User is logged into the application.

User has permission to create and submit expenses.

Steps to Reproduce
Navigate to the Expenses module.

Click Add Expense.

Fill in all the required expense details.

Click Save for Approval.

Observe the state of both action buttons.

Expected Result
Only the Save for Approval button should display the processing/loading state while the expense is being submitted. The Save as Draft button should remain in its normal state.

WADE-115
Change Password Dialog Becomes Unresponsive After Successful Password Update

Done

Description

After changing the password and confirming the action, the Change Password screen becomes unresponsive. The dialog does not close automatically, and the Close (X) button, Back button, and other UI elements become non-functional, preventing the user from interacting with the application.

Steps to Reproduce
Navigate to Profile/Settings.

Open the Change Password screen.

Enter the current password.

Enter a valid new password and confirm it.

Click Update/Change Password.

Observe the Change Password dialog after the request is processed.

Expected Result
After the password is successfully changed:

The Change Password dialog should close automatically or display a success message with an option to close it.

The Close (X) button, Back button, and other UI elements should remain responsive and functional.

here what is happening is that there is no loading state on the compoentn or button itself and then after the api resposne the site is reloading automatically which should not happen i think its to renew the tokens and all but do it in the bg silently and show a toast on top that password has bean successfully changed .

WADE-114

Timesheet Options Menu (Three-Dot Menu) Flickers and Does Not Display Menu Options
Done

Description

The three-dot (More Options) menu in the Timesheets module does not function correctly. When the user clicks the three-dot icon, the menu briefly flickers and disappears without displaying the available options, preventing users from accessing the actions. Also there is a slight Ui issue at the Notes Field scroller.

Steps to Reproduce
Navigate to the Timesheets module.

Locate any timesheet entry.

Click on the three-dot (More Options) icon.

Observe the behavior of the options menu.

Expected Result
Clicking the three-dot icon should display the available menu options (e.g., Edit, Delete, or other applicable actions) and keep the menu open until the user selects an option or clicks outside the menu.

WADE-113
Clear (X) Icon Is Missing in the Teams Search Field
Done
Description

The search field in the Teams module does not provide a clear (X) icon to quickly remove the entered search text. Users must manually delete the text, which impacts usability and user experience.

Steps to Reproduce
Navigate to the Teams module.

Enter any keyword in the search field.

Observe the search input after text is entered.

Expected Result
A Clear (X) icon should appear inside the search field after text is entered, allowing users to clear the search with a single click.

WADE-112
Add Timesheet Button Is Clickable Only on the Lower Portion Instead of the Entire Button Area
Done
Description
The Add Timesheet button is not fully clickable. Only the lower portion of the button responds to click events, while clicking on the remaining visible area has no effect. This results in an inconsistent user experience and makes the button difficult to interact with.

Preconditions
User is logged into the application.

User has access to the Timesheets module.

Steps to Reproduce
Navigate to the Timesheets module.

Locate the Add Timesheet button.

Click on the upper, left, or center portion of the button.

Observe that no action is triggered.

Click on the lower portion of the same button.

Observe that the Add Timesheet action is triggered successfully.

Expected Result
The entire visible area of the Add Timesheet button should be clickable and respond consistently to user clicks.

WADE-111
Assigned Team Lead is removed after page refresh
Done
Description

After assigning a Team Lead to a team and successfully saving the changes, the assigned Team Lead is removed automatically after refreshing the page. The assignment is not retained, resulting in data inconsistency.

Steps to Reproduce
Navigate to the Team module.

Create a new team or open an existing team.

Assign a Team Lead from the available list.

Click Save/Update to save the team details.

Verify that the Team Lead is successfully assigned.

Refresh the page (or navigate away and return to the Team details page).

Observe the Team Lead field.

Expected Result
The assigned Team Lead should remain associated with the team after the page is refreshed and the assignment should persist until it is intentionally changed or removed.

might be some query or cahcing issue but not sure should be a auto renew data request after any update creaet delete or shit like that for best user exp adn data sync

WADE-110
Incorrect Content/Text Issues
Done
Description

Several dialogs and validation messages display incorrect or misleading content, causing confusion for users.

Issues Identified
Incorrect confirmation content for Activate Project

The confirmation dialog displayed while activating a project contains the same content used for archiving a project.

Activation should have its own appropriate confirmation message.

Incorrect validation message for invalid verification code

When an incorrect verification code is entered, the displayed error message is not relevant to verification code validation.

The application should display an appropriate message indicating that the verification code is invalid or incorrect.

Delete Team confirmation dialog displays incorrect content

The Delete Team confirmation dialog displays archive-related content instead of delete-related content.

The dialog should clearly indicate that the selected team will be deleted.

i think i have alredy sent images of this

WADE-109

1

UI Issues Across Multiple Modules

Done

Description

Description
Multiple UI inconsistencies were identified across the application that affect readability and the overall user experience.

Issues Identified
Long text causes UI overflow in multiple modules

Long values entered in the following fields overflow their containers instead of wrapping or truncating properly:

Project Name

Phase Name

Milestone Name

Budget Item Name

Team Description

The overflowing text breaks the UI layout and impacts readability.

Project names are not displayed properly

Long project names are not displayed correctly in the Projects module.

The project name should be visible without breaking the layout.

same for this i think i have shared images already.

Fixed WADE tickets: WADE-109, WADE-110, WADE-111, WADE-112, WADE-113, WADE-114, WADE-115, WADE-116, WADE-117
