const db = require('../config/db');

// Create a new video call record
const create = async (callData) => {
    const { staffId, clientId, roomUrl, hostUrl, callType, scheduledTime, emergencyReason, notes, status } = callData;

    const result = await db.query(
        `INSERT INTO video_calls (staff_id, client_id, room_url, host_url, call_type, scheduled_time, emergency_reason, notes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [staffId || null, clientId, roomUrl, hostUrl, callType, scheduledTime || null, emergencyReason || null, notes || '', status || 'scheduled']
    );
    return result.rows[0];
};

// Find calls by staff ID (includes urgent emergencies)
const findByStaffId = async (staffId) => {
    const result = await db.query(
        `SELECT vc.*, u.full_name as client_name 
         FROM video_calls vc
         LEFT JOIN users u ON vc.client_id = u.id
         WHERE vc.staff_id = $1 OR vc.call_type = 'emergency'
         ORDER BY vc.status = 'urgent' DESC, vc.created_at DESC`,
        [staffId]
    );
    return result.rows;
};

// Find calls by client ID
const findByClientId = async (clientId) => {
    const result = await db.query(
        `SELECT vc.*, u.full_name as staff_name 
         FROM video_calls vc
         LEFT JOIN users u ON vc.staff_id = u.id
         WHERE vc.client_id = $1
         ORDER BY vc.created_at DESC`,
        [clientId]
    );
    return result.rows;
};

// Update call status
const updateStatus = async (callId, status, notes = null) => {
    const result = await db.query(
        `UPDATE video_calls 
         SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, notes, callId]
    );
    return result.rows[0] || null;
};

// Find call by ID
const findById = async (id) => {
    const result = await db.query('SELECT * FROM video_calls WHERE id = $1', [id]);
    return result.rows[0] || null;
};

// Update call details (including room URLs if time changed)
const update = async (callId, data) => {
    const { clientId, scheduledTime, notes, roomUrl, hostUrl } = data;
    const result = await db.query(
        `UPDATE video_calls 
         SET client_id = COALESCE($1, client_id), 
             scheduled_time = COALESCE($2, scheduled_time), 
             notes = COALESCE($3, notes),
             room_url = COALESCE($4, room_url),
             host_url = COALESCE($5, host_url),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [clientId || null, scheduledTime || null, notes || null, roomUrl || null, hostUrl || null, callId]
    );
    return result.rows[0] || null;
};

// Delete a call
const deleteCall = async (callId) => {
    const result = await db.query(
        'DELETE FROM video_calls WHERE id = $1 RETURNING id',
        [callId]
    );
    return result.rows[0] || null;
};

module.exports = {
    create,
    findByStaffId,
    findByClientId,
    updateStatus,
    findById,
    update,
    delete: deleteCall
};
