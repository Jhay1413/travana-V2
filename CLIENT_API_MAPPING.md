# Client API Endpoint Mapping: v1 → v2

Maps every client-side API call to its v1 route file and v2 module file.

---
tessst
## Auth

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/auth/user` | GET | `server/middlewares/auth/routes.ts` | `server/v2/middlewares/auth/require-auth.ts` |
| `/api/auth/login` | POST | `server/middlewares/auth/routes.ts` | `server/v2/middlewares/auth/require-auth.ts` |
| `/api/logout` | GET | `server/middlewares/auth/routes.ts` | `server/v2/middlewares/auth/require-auth.ts` |
| `/api/auth/change-password` | POST | `server/middlewares/auth/routes.ts` | `server/v2/middlewares/auth/require-auth.ts` |
| `/api/auth/profile` | PATCH | `server/middlewares/auth/routes.ts` | `server/v2/middlewares/auth/require-auth.ts` |
| `/api/auth/avatar` | POST | `server/middlewares/auth/routes.ts` | `server/v2/middlewares/auth/require-auth.ts` |

---

## Users

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/users` | GET | `server/routes/user.routes.ts` | `server/v2/modules/user/user.routes.ts` |
| `/api/users` | POST | `server/routes/user.routes.ts` | `server/v2/modules/user/user.routes.ts` |
| `/api/users/:id` | PATCH | `server/routes/user.routes.ts` | `server/v2/modules/user/user.routes.ts` |
| `/api/users/:id` | DELETE | `server/routes/user.routes.ts` | `server/v2/modules/user/user.routes.ts` |

---

## User Profiles ⚠️ BREAKING — v2 mount missing

> v1 mounts at `/user-profiles`. v2 dropped this prefix entirely — no `/user-profiles` route in `server/v2/routes/index.ts`.
> **Fix:** Add `router.use('/user-profiles', isAuthenticated, userProfileRoutes)` to v2 routes index.

| Client Endpoint | HTTP | v1 Route File | v2 Module | Status |
|---|---|---|---|---|
| `/api/user-profiles/me` | GET | `server/routes/userProfile.routes.ts` | **MISSING** | BREAKS |
| `/api/user-profiles/me` | PUT | `server/routes/userProfile.routes.ts` | **MISSING** | BREAKS |
| `/api/user-profiles/:userId` | GET | `server/routes/userProfile.routes.ts` | **MISSING** | BREAKS |

---

## Clients

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/clients` | GET | `server/routes/client.routes.ts` | `server/v2/modules/client/client.routes.ts` |
| `/api/clients` | POST | `server/routes/client.routes.ts` | `server/v2/modules/client/client.routes.ts` |
| `/api/clients/:id` | GET | `server/routes/client.routes.ts` | `server/v2/modules/client/client.routes.ts` |
| `/api/clients/:id` | PATCH | `server/routes/client.routes.ts` | `server/v2/modules/client/client.routes.ts` |

---

## Client Files

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/client-files/client/:clientId` | GET | `server/routes/clientFile.routes.ts` | `server/v2/modules/client/client-file.routes.ts` |
| `/api/client-files/client/:clientId` | POST | `server/routes/clientFile.routes.ts` | `server/v2/modules/client/client-file.routes.ts` |
| `/api/client-files/:id` | DELETE | `server/routes/clientFile.routes.ts` | `server/v2/modules/client/client-file.routes.ts` |
| `/api/client-files/:id/download` | GET | `server/routes/clientFile.routes.ts` | `server/v2/modules/client/client-file.routes.ts` |

---

## Transactions

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/transactions` | GET | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/:id` | GET | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions` | POST | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/:id` | PATCH | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/:id` | DELETE | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/pipeline` | GET | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/pipeline/:status` | GET | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/stats` | GET | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |
| `/api/transactions/expiring-quotes` | GET | `server/routes/transaction.routes.ts` | `server/v2/modules/transaction/transaction.routes.ts` |

---

## Quotes

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/quotes` | GET | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/free` | GET | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:id` | GET | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/social-post` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/duplicate` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:id` | PATCH | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:id` | DELETE | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/flights` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/flights/:flightId` | PATCH | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/flights/:flightId` | DELETE | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/accommodations` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/accommodations/:accommodationId` | PATCH | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/accommodations/:accommodationId` | DELETE | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/transfers` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/transfers/:transferId` | DELETE | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/passengers` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/passengers/:passengerId` | DELETE | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/images` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/images/upload` | POST | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/images/:imageId` | DELETE | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/images/:imageId/primary` | PATCH | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/tags` | GET | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |
| `/api/quotes/:quoteId/tags` | PUT | `server/routes/quote.routes.ts` | `server/v2/modules/quote/quote.routes.ts` |

---

## Bookings

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/bookings` | GET | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings` | POST | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:id` | GET | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:id` | PATCH | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:id` | DELETE | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/transaction/:transactionId` | GET | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/convert/:quoteId` | POST | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:bookingId/flights` | POST | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:bookingId/flights/:flightId` | DELETE | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:bookingId/accommodations` | POST | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |
| `/api/bookings/:bookingId/accommodations/:accommodationId` | DELETE | `server/routes/booking.routes.ts` | `server/v2/modules/booking/booking.routes.ts` |

---

## Enquiries

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/enquiries` | GET | `server/routes/enquiry.routes.ts` | `server/v2/modules/enquiry/enquiry.routes.ts` |
| `/api/enquiries` | POST | `server/routes/enquiry.routes.ts` | `server/v2/modules/enquiry/enquiry.routes.ts` |
| `/api/enquiries/:id` | GET | `server/routes/enquiry.routes.ts` | `server/v2/modules/enquiry/enquiry.routes.ts` |
| `/api/enquiries/:id` | PATCH | `server/routes/enquiry.routes.ts` | `server/v2/modules/enquiry/enquiry.routes.ts` |
| `/api/enquiries/:id` | DELETE | `server/routes/enquiry.routes.ts` | `server/v2/modules/enquiry/enquiry.routes.ts` |
| `/api/enquiries/transaction/:transactionId` | GET | `server/routes/enquiry.routes.ts` | `server/v2/modules/enquiry/enquiry.routes.ts` |

---

## Notes

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/notes/transaction/:transactionId` | GET | `server/routes/note.routes.ts` | `server/v2/modules/note/note.routes.ts` |
| `/api/notes` | POST | `server/routes/note.routes.ts` | `server/v2/modules/note/note.routes.ts` |
| `/api/notes/:id` | PATCH | `server/routes/note.routes.ts` | `server/v2/modules/note/note.routes.ts` |
| `/api/notes/:id` | DELETE | `server/routes/note.routes.ts` | `server/v2/modules/note/note.routes.ts` |

---

## Tickets

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/tickets` | GET | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |
| `/api/tickets` | POST | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |
| `/api/tickets/:id` | GET | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |
| `/api/tickets/:id` | PATCH | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |
| `/api/tickets/:id` | DELETE | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |
| `/api/tickets/client/:clientId` | GET | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |
| `/api/tickets/user/:userId` | GET | `server/routes/ticket.routes.ts` | `server/v2/modules/ticket/ticket.routes.ts` |

---

## Attachments

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/attachments/ticket/:ticketId` | GET | `server/routes/ticketAttachment.routes.ts` | `server/v2/modules/ticket/ticket-attachment.routes.ts` |
| `/api/attachments/ticket/:ticketId` | POST | `server/routes/ticketAttachment.routes.ts` | `server/v2/modules/ticket/ticket-attachment.routes.ts` |
| `/api/attachments/:id` | DELETE | `server/routes/ticketAttachment.routes.ts` | `server/v2/modules/ticket/ticket-attachment.routes.ts` |
| `/api/attachments/:id/download` | GET | `server/routes/ticketAttachment.routes.ts` | `server/v2/modules/ticket/ticket-attachment.routes.ts` |

---

## Replies

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/replies/ticket/:ticketId` | GET | `server/routes/ticketReply.routes.ts` | `server/v2/modules/ticket/ticket-reply.routes.ts` |
| `/api/replies/ticket/:ticketId` | POST | `server/routes/ticketReply.routes.ts` | `server/v2/modules/ticket/ticket-reply.routes.ts` |
| `/api/replies/:id` | PUT | `server/routes/ticketReply.routes.ts` | `server/v2/modules/ticket/ticket-reply.routes.ts` |
| `/api/replies/:id` | DELETE | `server/routes/ticketReply.routes.ts` | `server/v2/modules/ticket/ticket-reply.routes.ts` |

---

## Notifications

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/notifications` | GET | `server/routes/notification.routes.ts` | `server/v2/modules/notification/notification.routes.ts` |
| `/api/notifications/unread` | GET | `server/routes/notification.routes.ts` | `server/v2/modules/notification/notification.routes.ts` |
| `/api/notifications/:id/read` | PUT | `server/routes/notification.routes.ts` | `server/v2/modules/notification/notification.routes.ts` |
| `/api/notifications/read-all` | PUT | `server/routes/notification.routes.ts` | `server/v2/modules/notification/notification.routes.ts` |
| `/api/notifications/:id` | DELETE | `server/routes/notification.routes.ts` | `server/v2/modules/notification/notification.routes.ts` |

---

## Tasks

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/tasks/all` | GET | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |
| `/api/tasks/all-extended` | GET | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |
| `/api/tasks` | GET | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |
| `/api/tasks` | POST | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |
| `/api/tasks/:id/toggle` | PUT | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |
| `/api/tasks/user` | GET | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |
| `/api/tasks/:id` | DELETE | `server/routes/task.routes.ts` | `server/v2/modules/task/task.routes.ts` |

---

## Favorites

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/favorites` | GET | `server/routes/favorite.routes.ts` | `server/v2/modules/favorite/favorite.routes.ts` |
| `/api/favorites` | POST | `server/routes/favorite.routes.ts` | `server/v2/modules/favorite/favorite.routes.ts` |
| `/api/favorites/toggle` | POST | `server/routes/favorite.routes.ts` | `server/v2/modules/favorite/favorite.routes.ts` |
| `/api/favorites/check` | GET | `server/routes/favorite.routes.ts` | `server/v2/modules/favorite/favorite.routes.ts` |
| `/api/favorites/:id` | DELETE | `server/routes/favorite.routes.ts` | `server/v2/modules/favorite/favorite.routes.ts` |

---

## Tags

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/tags` | GET | `server/routes/tag.routes.ts` | `server/v2/modules/tag/tag.routes.ts` |
| `/api/tags/search` | GET | `server/routes/tag.routes.ts` | `server/v2/modules/tag/tag.routes.ts` |

---

## Tour Operators

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/tour-operators` | GET | `server/routes/tourOperator.routes.ts` | `server/v2/modules/tour-operator/tour-operator.routes.ts` |
| `/api/tour-operators` | POST | `server/routes/tourOperator.routes.ts` | `server/v2/modules/tour-operator/tour-operator.routes.ts` |
| `/api/tour-operators/:id` | PATCH | `server/routes/tourOperator.routes.ts` | `server/v2/modules/tour-operator/tour-operator.routes.ts` |
| `/api/tour-operators/:id` | DELETE | `server/routes/tourOperator.routes.ts` | `server/v2/modules/tour-operator/tour-operator.routes.ts` |

---

## Airports

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/airports` | GET | `server/routes/airport.routes.ts` | `server/v2/modules/airport/airport.routes.ts` |
| `/api/airports` | POST | `server/routes/airport.routes.ts` | `server/v2/modules/airport/airport.routes.ts` |
| `/api/airports/:id` | DELETE | `server/routes/airport.routes.ts` | `server/v2/modules/airport/airport.routes.ts` |

---

## Dashboard

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/dashboard/stats` | GET | `server/routes/dashboard.routes.ts` | `server/v2/modules/dashboard/dashboard.routes.ts` |
| `/api/dashboard/my-profit` | GET | `server/routes/dashboard.routes.ts` | `server/v2/modules/dashboard/dashboard.routes.ts` |
| `/api/dashboard/admin-overview-stats` | GET | `server/routes/dashboard.routes.ts` | `server/v2/modules/dashboard/dashboard.routes.ts` |

---

## Opportunities

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/opportunities/enquiries` | GET | `server/routes/opportunities.routes.ts` | `server/v2/modules/opportunities/opportunities.routes.ts` |
| `/api/opportunities/quotes` | GET | `server/routes/opportunities.routes.ts` | `server/v2/modules/opportunities/opportunities.routes.ts` |
| `/api/opportunities/bookings` | GET | `server/routes/opportunities.routes.ts` | `server/v2/modules/opportunities/opportunities.routes.ts` |
| `/api/opportunities/agents` | GET | `server/routes/opportunities.routes.ts` | `server/v2/modules/opportunities/opportunities.routes.ts` |

---

## Revenue

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/revenue/dashboard` | GET | `server/routes/revenue.routes.ts` | `server/v2/modules/revenue/revenue.routes.ts` |
| `/api/revenue/month-bookings/:year/:month` | GET | `server/routes/revenue.routes.ts` | `server/v2/modules/revenue/revenue.routes.ts` |
| `/api/revenue/month-forwards/:year/:month` | GET | `server/routes/revenue.routes.ts` | `server/v2/modules/revenue/revenue.routes.ts` |

---

## Targets

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/targets/overview` | GET | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |
| `/api/targets/shop` | GET | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |
| `/api/targets/shop` | POST | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |
| `/api/targets/agent` | GET | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |
| `/api/targets/agent/:userId` | GET | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |
| `/api/targets/agent` | POST | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |
| `/api/targets/agents` | GET | `server/routes/targets.routes.ts` | `server/v2/modules/targets/targets.routes.ts` |

---

## Chat

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/chat/conversations` | GET | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |
| `/api/chat/conversations/:conversationId/messages` | GET | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |
| `/api/chat/conversations/:conversationId/messages` | POST | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |
| `/api/chat/conversations/:conversationId/messages/upload` | POST | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |
| `/api/chat/direct` | POST | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |
| `/api/chat/group` | POST | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |
| `/api/chat/conversations/:conversationId/read` | POST | `server/routes/chat.routes.ts` | `server/v2/modules/chat/chat.routes.ts` |

---

## Social Posts

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/social-posts/generate` | POST | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/quote/:quoteId` | GET | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/:id` | PATCH | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/:id/schedule` | POST | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/:id/reschedule` | PUT | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/media/upload` | POST | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/:id/media` | GET | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |
| `/api/social-posts/quote/:quoteId/images` | GET | `server/routes/social-post.routes.ts` | `server/v2/modules/social-post/social-post.routes.ts` |

---

## Announcements

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/announcements` | GET | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements` | POST | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/:id` | PATCH | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/:id/pin` | PATCH | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/:id` | DELETE | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/:id/like` | POST | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/:id/likes` | GET | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/likes/bulk` | GET | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/:id/share` | POST | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/upload-image` | POST | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |
| `/api/announcements/mentionable-users` | GET | `server/routes/announcement.routes.ts` | `server/v2/modules/announcement/announcement.routes.ts` |

---

## Hub Posts

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/hub-posts` | GET | `server/routes/hubPost.routes.ts` | `server/v2/modules/hub-post/hub-post.routes.ts` |
| `/api/hub-posts` | POST | `server/routes/hubPost.routes.ts` | `server/v2/modules/hub-post/hub-post.routes.ts` |
| `/api/hub-posts/:id` | DELETE | `server/routes/hubPost.routes.ts` | `server/v2/modules/hub-post/hub-post.routes.ts` |
| `/api/hub-posts/:id/like` | POST | `server/routes/hubPost.routes.ts` | `server/v2/modules/hub-post/hub-post.routes.ts` |
| `/api/hub-posts/:id/comment` | POST | `server/routes/hubPost.routes.ts` | `server/v2/modules/hub-post/hub-post.routes.ts` |

---

## Email

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/emails/accounts/shared` | GET | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts/user/:userId` | GET | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts` | POST | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts/:id` | DELETE | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts/:id/test` | GET | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts/:accountId/messages` | GET | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts/:accountId/messages/:uid` | GET | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |
| `/api/emails/accounts/:accountId/send` | POST | `server/routes/email.routes.ts` | `server/v2/modules/email/email.routes.ts` |

---

## Facebook

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/facebook/pages` | GET | `server/routes/facebook.routes.ts` | `server/v2/modules/facebook/facebook.routes.ts` |
| `/api/facebook/pages/:pageId` | DELETE | `server/routes/facebook.routes.ts` | `server/v2/modules/facebook/facebook.routes.ts` |
| `/api/facebook/pages/:pageId/conversations` | GET | `server/routes/facebook.routes.ts` | `server/v2/modules/facebook/facebook.routes.ts` |
| `/api/facebook/conversations/:conversationId/messages` | GET | `server/routes/facebook.routes.ts` | `server/v2/modules/facebook/facebook.routes.ts` |
| `/api/facebook/pages/:pageId/send` | POST | `server/routes/facebook.routes.ts` | `server/v2/modules/facebook/facebook.routes.ts` |

---

## Referrals

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/referrals` | GET | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals` | POST | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/:id` | GET | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/:id` | PATCH | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/:id` | DELETE | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/client/:clientId` | GET | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/client/:clientId/stats` | GET | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/client/:clientId/vip-overview` | GET | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |
| `/api/referrals/:id/status` | PATCH | `server/routes/referral.routes.ts` | `server/v2/modules/referral/referral.routes.ts` |

---

## Referral Payouts

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/referral-payouts` | GET | `server/routes/referralPayout.routes.ts` | `server/v2/modules/referral/referral-payout.routes.ts` |
| `/api/referral-payouts/:id` | GET | `server/routes/referralPayout.routes.ts` | `server/v2/modules/referral/referral-payout.routes.ts` |
| `/api/referral-payouts/:id/approve` | PATCH | `server/routes/referralPayout.routes.ts` | `server/v2/modules/referral/referral-payout.routes.ts` |
| `/api/referral-payouts/:id/reject` | PATCH | `server/routes/referralPayout.routes.ts` | `server/v2/modules/referral/referral-payout.routes.ts` |

---

## Referral Withdrawals

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/referral-withdrawals` | GET | `server/routes/referralWithdrawal.routes.ts` | `server/v2/modules/referral/referral-withdrawal.routes.ts` |
| `/api/referral-withdrawals/:id` | GET | `server/routes/referralWithdrawal.routes.ts` | `server/v2/modules/referral/referral-withdrawal.routes.ts` |
| `/api/referral-withdrawals/:id/process` | PATCH | `server/routes/referralWithdrawal.routes.ts` | `server/v2/modules/referral/referral-withdrawal.routes.ts` |
| `/api/referral-withdrawals/:id/reject` | PATCH | `server/routes/referralWithdrawal.routes.ts` | `server/v2/modules/referral/referral-withdrawal.routes.ts` |
| `/api/referral-withdrawals/:id/invoice` | GET | `server/routes/referralWithdrawal.routes.ts` | `server/v2/modules/referral/referral-withdrawal.routes.ts` |

---

## Wallet

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/wallet/` | GET | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |
| `/api/wallet/client/:clientId/balance` | GET | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |
| `/api/wallet/client/:clientId/transactions` | GET | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |
| `/api/wallet/client/:clientId/apply-booking-credit` | POST | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |
| `/api/wallet/transactions/:id/process` | PATCH | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |
| `/api/wallet/transactions/:id/reject` | PATCH | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |
| `/api/wallet/transactions/:id/invoice` | GET | `server/routes/wallet.routes.ts` | `server/v2/modules/wallet/wallet.routes.ts` |

---

## Search

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/search` | GET | `server/routes/search.routes.ts` | `server/v2/modules/search/search.routes.ts` |

---

## JSON Mapper

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/json-mapper/map-to-ids` | POST | `server/routes/json-mapper.routes.ts` | `server/v2/modules/json-mapper/json-mapper.routes.ts` |

---

## Destination Guru

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/destination-guru` | GET | `server/routes/destination-guru.routes.ts` | `server/v2/modules/destination-guru/destination-guru.routes.ts` |
| `/api/destination-guru/:id` | GET | `server/routes/destination-guru.routes.ts` | `server/v2/modules/destination-guru/destination-guru.routes.ts` |
| `/api/destination-guru/search/:destination` | GET | `server/routes/destination-guru.routes.ts` | `server/v2/modules/destination-guru/destination-guru.routes.ts` |
| `/api/destination-guru/generate` | POST | `server/routes/destination-guru.routes.ts` | `server/v2/modules/destination-guru/destination-guru.routes.ts` |
| `/api/destination-guru/:id` | DELETE | `server/routes/destination-guru.routes.ts` | `server/v2/modules/destination-guru/destination-guru.routes.ts` |

---

## Neon Clients

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/neon-clients` | GET | `server/routes/neonClient.routes.ts` | `server/v2/modules/neon-client/neon-client.routes.ts` |
| `/api/neon-clients` | POST | `server/routes/neonClient.routes.ts` | `server/v2/modules/neon-client/neon-client.routes.ts` |
| `/api/neon-clients/:id` | GET | `server/routes/neonClient.routes.ts` | `server/v2/modules/neon-client/neon-client.routes.ts` |
| `/api/neon-clients/:id` | PATCH | `server/routes/neonClient.routes.ts` | `server/v2/modules/neon-client/neon-client.routes.ts` |
| `/api/neon-clients/import` | POST | `server/routes/neonClient.routes.ts` | `server/v2/modules/neon-client/neon-client.routes.ts` |

---

## Feedback

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/feedback` | GET | `server/routes/feedback.routes.ts` | `server/v2/modules/feedback/feedback.routes.ts` |
| `/api/feedback` | POST | `server/routes/feedback.routes.ts` | `server/v2/modules/feedback/feedback.routes.ts` |
| `/api/feedback/mine` | GET | `server/routes/feedback.routes.ts` | `server/v2/modules/feedback/feedback.routes.ts` |
| `/api/feedback/:id/status` | PATCH | `server/routes/feedback.routes.ts` | `server/v2/modules/feedback/feedback.routes.ts` |
| `/api/feedback/:id` | DELETE | `server/routes/feedback.routes.ts` | `server/v2/modules/feedback/feedback.routes.ts` |

---

## Lookup

| Client Endpoint | HTTP | v1 Route File | v2 Module |
|---|---|---|---|
| `/api/lookup/package-types` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/countries` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/destinations` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/resorts` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/accommodations` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/board-basis` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/parks` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/lodges` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/cottages` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/accommodation-types` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/room-types` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/accommodation-images` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/lodge-images` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/cruise-lines` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/ships` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |
| `/api/lookup/cruise-itineraries` | GET | `server/routes/lookup.routes.ts` | `server/v2/lookup/lookup.routes.ts` |

---

## Public Routes (no auth)

These are mounted directly on the app before auth middleware in `index.ts`.

| Client Endpoint | HTTP | v1 Mount | v2 Mount |
|---|---|---|---|
| `/api/public/quote/:token` | GET | `server/index.ts` → `server/modules/quote/quote-public.routes.ts` | `server/v2/index.ts` → `server/v2/modules/quote/quote-public.routes.ts` |
| `/api/public/quote/:token/view` | POST | same | same |
| `/api/public/quote/:token/action` | POST | same | same |
| `/api/public/website/deals` | GET | `server/index.ts` → `server/routes/website-public.routes.ts` | `server/v2/index.ts` → `server/v2/modules/website-public/website-public.routes.ts` |
| `/api/public/website/deals/latest` | GET | same | same |
| `/api/public/website/deals/featured` | GET | same | same |
| `/api/public/website/deals/categories` | GET | same | same |
| `/api/public/website/deals/filters` | GET | same | same |
| `/api/public/website/deals/:id` | GET | same | same |
| `/api/public/website/destinations` | GET | same | same |
| `/api/public/website/destinations/:name` | GET | same | same |
| `/api/public/website/stats` | GET | same | same |
| `/api/facebook/webhook` | GET/POST | `server/index.ts` (inline router) | `server/v2/index.ts` (inline router) |
| `/api/facebook/callback` | GET | same | same |

---

## New v2 Endpoints (no client API yet)

These are new SaaS modules in v2 with no corresponding client API files yet.

| v2 Endpoint Prefix | v2 Module | Purpose |
|---|---|---|
| `/api/branches` | `server/v2/modules/branch/branch.routes.ts` | Branch management within an org |
| `/api/invites` | `server/v2/modules/invite/invite.routes.ts` | 48h token invite flow |
| `/api/onboarding` | `server/v2/modules/onboarding/onboarding.routes.ts` | 3-step org signup wizard |
| `/api/platform-admin` | `server/v2/modules/platform-admin/platform-admin.routes.ts` | Super-admin org management |

---

## Issues to Fix Before v2 Go-Live

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | `/api/user-profiles` mount missing in v2 `routes/index.ts` | All 3 user-profile client calls return 404 | Add `router.use('/user-profiles', isAuthenticated, userProfileRoutes)` to `server/v2/routes/index.ts` |
