INSTRUCTIONS

Do all these changes in the most least changes and minimilistic way do it one by one and give me update and then when i tell to go on another one then do that the changes should be minimal and should not change the fuctunality but just add or remove what i have told also same with the website layout only change layout when i tell it and then too only change it according to the theme and it should be a fitting layout for that section with reponsiveness.

brake the code in fuctions, sections, componenets, utils, services, hooks according to there use case and code quality and structure of the project and have a small one line comment over it to tell what it does code should not be nested but refrensial so like i have a complex fuction which does a lot of logical things brake it in multiple substep fuction and run those fuction conditionally and with parametres and have comments over that what it is doing so i dont have to read 200 line fuction but rather just small fuctions which i have the use case for.

TASKS.

1.  change wade to logo from public / static / images / .png.
    change wade super admin to wade_logo super admin or anything like that which will look good.
    components/layout/Layout.tsx
    components/modules/authentication/auth.ui.tsx

2.  on mobile the left side menu which comes after click of hand burger menu

- give an comming from left animation so it looks good.
- the cross button to close the sidebar nav it is currently on left side move it to the right most side of the page for a better ux and have the logo superadmin on left most side.

==========================================================

3.

==========================================================

==========================================================
.4 In the notification page in the view agency section
app/notifications/page.tsx
mappedNotifications.map((notif) => (
<NotificationItemCard
                                key={notif.id}
                                item={notif}
                                onMarkAsRead={handleMarkAsRead}
                                onTriggerAction={handleTriggerAction}
                            />

    // Map db notifications to components type definition NotificationItem
    const mappedNotifications = useMemo(() => {
        return notifications.map((notif): NotificationItem => {
            return {
                id: notif.id,
                category: notif.type as NotificationCategory,
                title: notif.title,
                description: notif.body,
                timestamp: new Date(notif.created_at).toLocaleDateString(),
                isRead: !!notif.read_at,
                actionLabel:
                    notif.metadata?.actionLabel ||
                    (notif.type === "billing"
                        ? "View Billing"
                        : notif.type === "agency" || notif.type === "query"
                          ? "View Agency"
                          : undefined),
                actionPath: notif.metadata?.actionPath || undefined,
                numericMetadata: notif.metadata?.amount ? `$${notif.metadata.amount}` : undefined,
                metadata: notif.metadata,
            };
        });
    }, [notifications]);


    const handleTriggerAction = async (item: NotificationItem) => {
        setActionLoadingId(item.id);
        try {
            await handleMarkAsRead(item.id);
            const searchValue = getActionSearchValue(item);
            const query = searchValue ? `?search=${encodeURIComponent(searchValue)}` : "";
            const category = item.category;
            if (category === "billing") {
                router.push(`/subscription-billing-management${query}`);
            } else if (category === "agency" || category === "query") {
                const separator = query ? "&" : "?";
                router.push(`/agency-management${query}${separator}openModal=true`);
            } else if (category === "security") {
                router.push("/ai-platform-configuration");
            }
        } catch (error) {
            console.error("Action trigger failed:", error);
            setActionLoadingId(null);
        }
    };

here what we have a shit like on click of this we will open the https://budget-tracker-superadmin.vercel.app/agency-management?search=350ebaad-0d91-4543-bcd0-fe82c5e7838c&openModal=true

and basically what it does is have the page open the automatically fill the search term and open the modal but the id we are sending is a security concern for us right now so what we want is to send email and remove the id matching logic from the api too so its secure and user cant brute force the agency id

app/api/agencies/route.ts

        // Apply Search Query across name and slug (domain)
        if (searchQuery) {
            if (searchQuery.includes("@")) {
                query = query.ilike("profiles.email", `%${searchQuery}%`);
            } else {
                const isUuid =
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                        searchQuery
                    );
                if (isUuid) {
                    query = query.or(
                        `name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%,id.eq.${searchQuery}`
                    );
                } else {
                    query = query.or(`name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`);
                }
            }
        }

==========================================================

==========================================================

.5 In the notification section.

app/notifications/page.tsx

We have a mark all as read button which marks all which are on the current page of pagination so make it naem soo and we need two buttons another button which name will be mark all as read which will mark all in that category as read dispite pagination.

need another filter looking like
{CATEGORY_FILTER_OPTIONS.map((opt) => (

<div key={opt.value} className="shrink-0">
<CategoryTab
label={opt.label}
active={activeCategory === opt.value}
onClick={() => {
setActiveCategory(opt.value);
setCurrentPage(1);
}}
count={unreadCounts[opt.value] || 0}
/>
</div>
))}
to have all unread and read soo a new level of sorting and it should be from the api itself.
==========================================================

==========================================================

.6
Make the user profile image opacity a little lower.
components/layout/layout.components.tsx
{/_ Profile Avatar _/}
{user?.avatarUrl && !imageError ? (
<Image
src={getCacheBustedUrl(user.avatarUrl, user.updatedAt) || ""}
alt={profile?.full_name || "Profile avatar"}
onError={() => setImageError(true)}
width={32}
height={32}
className="w-8 h-8 rounded-sm object-cover shrink-0 border border-border"
unoptimized
/>
)
==========================================================

==========================================================

.7
Do a securtiy audit check for the application is the application secure are the apis only sending the data which is required or getting the data whcih is required are all the routes authenticated and autharized for superadmin check and token check.

any vernability on api or middleware or frotnend side.

are there any other security vernability give me a security audit log for this.

==========================================================

==========================================================

.8 Add rate limiting to the application and send and show proper error to the frontend from backend.

==========================================================

.9 audit logs of unused commented and not required code in the application with proper file and line number links.

.10 need site wide code quality clean up

PHASE 2:

IMPORTATN NOTES:

ACT LIKE A SENIOR SOFTWARE ENG WHO HAVE TO WORK ON THIS SHIT CODEBASE BUT ALSO HAVE TO FIX ITS CODE QULATIY REUSABLILITY PERFORMANCE AND UNDERSTANDABILTIY ALONGSIDE YOU WORK WHEN YOU NOTICE SOME SHIT WRONG THING HAPPENIGN YOU FIX IT IN THE LEAST LINE OF CHAGNE POSSIBEL DONT ADD FEATURE BUT MORE LIKE MAKE THING CENTERAL AND REUSABLE AND ABSTRACTED.

ANY FEATURE YOU KNOW WHICH HAS BEAN IMPLEMENTED BEFORE BY YOU OR IN EXISTING CODE AND IS BEIGN USED AGAIN OR YOU SEE A FEATURE WHICH HAS BEEN GETTIGN USED MULITPLE TIMES TYPE SHIT MAKE A COMMON SERVICE COMPONETN UTIL ANYTHIGN WHICH TYPE THAT THING IS AND REUSE IT HAVE BETTER CODE QULAITY

TRY TO MATCH THE REQUIREMENTS IN THE LEAST LINES OF CODE AND CODE SPLIT IN PARTS EASY TO UNDERSTAND AND GO THOUGH.

11.

settings page

image change
app/settings/page.tsx

  <div className="flex items-center gap-5 pb-4 border-b border-hairline/60">
                                {updateProfileForm.avatarUrl && !imageError ? (
                                    <Image
                                        src={
                                            getCacheBustedUrl(
                                                updateProfileForm.avatarUrl,
                                                updateProfileForm.updatedAt
                                            ) || ""
                                        }
                                        width={64}
                                        height={64}
                                        alt="Avatar"
                                        onError={() => setImageError(true)}
                                        className="w-16 h-16 rounded-sm object-cover shadow-md shrink-0 border border-hairline"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-brand-dark flex items-center justify-center text-canvas text-[22px] font-brandMedium uppercase select-none shadow-md shrink-0">
                                        {updateProfileForm.full_name
                                            ? updateProfileForm.full_name
                                                  .split(" ")
                                                  .map((n: string) => n[0])
                                                  .join("")
                                            : "SA"}
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <h4 className="text-[14px] font-brandMedium text-ink leading-none">
here add on clcik on image open model to select file like we have change photo link button.

12.

# notifications page

remove dummy data
added page level and overall mark all as read, and filters of read unread and all

need to add a query chat system.
make it look match the theme and should look good and should be able to open for a query chat and should be able to send and take response but noo webhooks just a query reply system and there show the agency name user name and user the user who made the query email.

proper triggers to have data of agency payments and querys.

add modal when click on the notification showing the notificaiton with good heading detail show the agency and a little agency detail like name email and in case of billing details accoring to that.

on notification which are alreay read we dont have a dot on them showign that they are already read but it does not make them look unique enough to ignore make the color and theme of that component soo it feels like they are already read.

when click on a notification of a query dont open modal open the chat interface we have implemented above make basic api for now which will act like they are storing data and fetching data we dont have the db table setup in place but we have to make this feature and chat will not be websockets.

on click of the view agency send to the agency page with pre filled search field as the agency email id and i foudn a @ issue that when searchign email it send all results maybe its a query issue like sql injection type shit soo fix that oo

13.

# ai config page

set max limit of 10 billion on  
AI Usage Cap Threshold (Tokens)
and of 1 billion on
Max Output Token Limit

with proper error showing that max limit.

14.

# Broadcast Announcement in teh ai config page

on todays click it's not setting today only after clear and should not pick hour automtically but just have this for today type shit.

15.

# Subscription & Billing Management page

filters not working
should have a new filter on the bases of new and renew
should have a new filter on the bases of plans
should have a new filter on the bases of payment status type like failed or paid which stripe sends basically i want the types from stripe.

and in search invoice id agency name email only for now remove any other old search param but new one should work correctly

on click of the agency name it should move to the agency page and use the same feature of the notification section to show the agency by using the name of the agency and basically autosearch and open modal to show his details and clearly show in the table that its a clickable. like on hover effect and also mouse pointer

16.

# Agency Management

get the Subscription Tier fitler value from db first not static.
and a sort on the basis of revenue.
search should only work with agency name slug email and write that in search bar too that these are the supported once.

17.

# Platform Overview

Subscription tier featch from db not static value and check on the basis of that

System Audit Trail
Paginated server-side log with filters

here fitler should be
date range like its working right now.
category it should be fetched from db for categories of events.
and then teh event type it should be fetched too and also have a filter on it that only show those which are for that category so like in team just show team.create team.update for eg type thing

in search

search on the bases of user name email agency name agency email

and takign reference from these thing try to fix the stripe webhook table and its filters too.
