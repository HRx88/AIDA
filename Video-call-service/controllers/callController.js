const Call = require('../models/callModel');

// Whereby API configuration
const WHEREBY_API_KEY = process.env.WHEREBY_API_KEY;
const WHEREBY_API_URL = 'https://api.whereby.dev/v1';

/**
 * Create a Whereby room (or placeholder if no API key)
 */
const createWherebyRoom = async (roomName, isLocked = false) => {
    if (!WHEREBY_API_KEY || WHEREBY_API_KEY === 'your_key_here') {
        console.warn('Whereby API key not configured. Using placeholder URLs.');
        return {
            roomUrl: `https://whereby.com/aida-demo-${roomName}`,
            hostRoomUrl: `https://whereby.com/aida-demo-${roomName}?roomKey=host`,
            meetingId: `demo-${Date.now()}`
        };
    }

    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 24);

    const response = await fetch(`${WHEREBY_API_URL}/meetings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHEREBY_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            roomNamePrefix: roomName,
            roomMode: 'normal',
            endDate: endDate.toISOString(),
            isLocked: isLocked,
            fields: ['hostRoomUrl', 'viewerRoomUrl']
        })
    });

    if (!response.ok) {
        throw new Error('Failed to create Whereby room');
    }

    return await response.json();
};

/**
 * Staff creates a check-in call
 */
const createCheckInCall = async (req, res) => {
    const { staffId, clientId, scheduledTime, notes } = req.body;

    if (!staffId || !clientId) {
        return res.status(400).json({ message: 'Staff ID and Client ID are required' });
    }

    try {
        const roomName = `checkin-${staffId}-${clientId}-${Date.now()}`;
        const wherebyRoom = await createWherebyRoom(roomName, true);

        let savedCall = null;
        try {
            savedCall = await Call.create({
                staffId,
                clientId,
                roomUrl: wherebyRoom.roomUrl,
                hostUrl: wherebyRoom.hostRoomUrl,
                callType: 'checkin',
                scheduledTime: scheduledTime || new Date(),
                notes: notes || '',
                status: 'scheduled'
            });
        } catch (dbErr) {
            console.warn('Database save failed:', dbErr.message);
        }

        res.status(201).json({
            message: 'Check-in call created successfully',
            call: savedCall,
            hostUrl: wherebyRoom.hostRoomUrl,
            clientUrl: wherebyRoom.roomUrl
        });

    } catch (err) {
        console.error('Error creating check-in call:', err);
        res.status(500).json({ message: 'Failed to create check-in call' });
    }
};

/**
 * Client triggers emergency call
 */
const createEmergencyCall = async (req, res) => {
    const { clientId, emergencyReason } = req.body;

    if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required' });
    }

    try {
        const roomName = `emergency-${clientId}-${Date.now()}`;
        const wherebyRoom = await createWherebyRoom(roomName, false);

        let savedCall = null;
        try {
            savedCall = await Call.create({
                clientId,
                roomUrl: wherebyRoom.roomUrl,
                hostUrl: wherebyRoom.hostRoomUrl,
                callType: 'emergency',
                emergencyReason: emergencyReason || 'Emergency assistance needed',
                status: 'urgent'
            });
        } catch (dbErr) {
            console.warn('Database save failed:', dbErr.message);
        }

        console.log(`🚨 EMERGENCY CALL from Client ${clientId}:`, emergencyReason);

        res.status(201).json({
            message: 'Emergency call created - Staff will be notified',
            call: savedCall,
            roomUrl: wherebyRoom.roomUrl
        });

    } catch (err) {
        console.error('Error creating emergency call:', err);
        res.status(500).json({ message: 'Failed to create emergency call' });
    }
};

/**
 * Get calls for staff
 */
const getStaffCalls = async (req, res) => {
    const { staffId } = req.params;

    try {
        const calls = await Call.findByStaffId(staffId);
        res.json({ calls });
    } catch (err) {
        console.error('Error fetching staff calls:', err);
        res.status(500).json({ message: 'Failed to fetch calls', calls: [] });
    }
};

/**
 * Get calls for client
 */
const getClientCalls = async (req, res) => {
    const { clientId } = req.params;

    try {
        const calls = await Call.findByClientId(clientId);
        res.json({ calls });
    } catch (err) {
        console.error('Error fetching client calls:', err);
        res.status(500).json({ message: 'Failed to fetch calls', calls: [] });
    }
};

/**
 * Update call status
 */
const updateCallStatus = async (req, res) => {
    const { callId } = req.params;
    const { status, notes } = req.body;

    try {
        const updatedCall = await Call.updateStatus(callId, status, notes);

        if (!updatedCall) {
            return res.status(404).json({ message: 'Call not found' });
        }

        res.json({ message: 'Call updated', call: updatedCall });

    } catch (err) {
        console.error('Error updating call:', err);
        res.status(500).json({ message: 'Failed to update call' });
    }
};

module.exports = {
    createCheckInCall,
    createEmergencyCall,
    getStaffCalls,
    getClientCalls,
    updateCallStatus
};
