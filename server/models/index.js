import sequelize from "../config/database.js";
import Event from "./Event.js";
import User from "./User.js";
import Registration from "./Registration.js";
import Payment from "./Payment.js";
import Ticket from "./Ticket.js";
import Feedback from "./Feedback.js";
import Waitlist from "./Waitlist.js";
import SavedEvent from "./SavedEvent.js";
import Notification from "./Notification.js";
import AgendaItem from "./AgendaItem.js";

// ── Associations ────────────────────────────────────────────

// Registration belongs to Event and User
Registration.belongsTo(Event, { foreignKey: "event_id", targetKey: "event_id", as: "event" });
Event.hasMany(Registration, { foreignKey: "event_id", sourceKey: "event_id", as: "registrations" });

Registration.belongsTo(User, { foreignKey: "user_id", targetKey: "user_id", as: "user" });
User.hasMany(Registration, { foreignKey: "user_id", sourceKey: "user_id" });

// Payment belongs to Registration
Payment.belongsTo(Registration, { foreignKey: "registration_id", targetKey: "registration_id", as: "registration" });
Registration.hasOne(Payment, { foreignKey: "registration_id", sourceKey: "registration_id", as: "payment" });

// Ticket belongs to Event
Ticket.belongsTo(Event, { foreignKey: "event_id", targetKey: "event_id", as: "event" });
Event.hasMany(Ticket, { foreignKey: "event_id", sourceKey: "event_id", as: "tickets" });

// Feedback: one per user per event
Feedback.belongsTo(Event, { foreignKey: "event_id", targetKey: "event_id", as: "event" });
Feedback.belongsTo(User, { foreignKey: "user_id", targetKey: "user_id", as: "user" });
Event.hasMany(Feedback, { foreignKey: "event_id", sourceKey: "event_id", as: "feedback" });

// Waitlist
Waitlist.belongsTo(Event, { foreignKey: "event_id", targetKey: "event_id", as: "event" });
Waitlist.belongsTo(User, { foreignKey: "user_id", targetKey: "user_id", as: "user" });
Event.hasMany(Waitlist, { foreignKey: "event_id", sourceKey: "event_id", as: "waitlist" });

// Saved events (bookmarks)
SavedEvent.belongsTo(Event, { foreignKey: "event_id", targetKey: "event_id", as: "event" });
Event.hasMany(SavedEvent, { foreignKey: "event_id", sourceKey: "event_id", as: "saves" });

// Notification center
User.hasMany(Notification, { foreignKey: "user_id", sourceKey: "user_id", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "user_id", targetKey: "user_id", as: "user" });

// Agenda items
AgendaItem.belongsTo(Event, { foreignKey: "event_id", targetKey: "event_id", as: "agendaItems" });
Event.hasMany(AgendaItem, { foreignKey: "event_id", sourceKey: "event_id", as: "agendaItems" });

// ── Export ───────────────────────────────────────────────────
export { sequelize, Event, User, Registration, Payment, Ticket, Feedback, Waitlist, SavedEvent, Notification, AgendaItem };
