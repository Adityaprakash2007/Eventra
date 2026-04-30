import sequelize from "../config/database.js";
import Event from "./Event.js";
import User from "./User.js";
import Registration from "./Registration.js";
import Payment from "./Payment.js";
import Ticket from "./Ticket.js";

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

// ── Export ───────────────────────────────────────────────────
export { sequelize, Event, User, Registration, Payment, Ticket };
