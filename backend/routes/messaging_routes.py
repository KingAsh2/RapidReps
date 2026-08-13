"""Messaging routes: conversations and messages. Extracted from server.py (Iteration 85)."""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
import uuid
import asyncio

from deps import db, get_current_user, sanitize_text, create_and_send_notification
from models import MessageCreate, MessageResponse, ConversationResponse
from utils.message_filter import check_message, user_facing_reason

router = APIRouter(prefix="/api")


@router.post("/messages", response_model=MessageResponse)
async def send_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message to another user."""
    sender_id = str(current_user['_id'])
    receiver_id = message_data.receiverId

    # iter118be: contact-info / off-platform filter. Block-and-log — first
    # offense is only a warning; repeat offenders surface in admin queue.
    raw_content = message_data.content or ""
    # Admin-to-user messages are exempt (support may need to send an email
    # or phone to escalate a real issue).
    if not bool(current_user.get('isAdmin')):
        flag = check_message(raw_content)
        if flag:
            # Find or create the conversation id so the log ties to a thread.
            existing = await db.conversations.find_one({
                'participants': {'$all': [sender_id, receiver_id]}
            })
            conv_id = str(existing['_id']) if existing else None
            try:
                await db.chat_flags.insert_one({
                    '_id': str(uuid.uuid4()),
                    'userId': sender_id,
                    'receiverId': receiver_id,
                    'conversationId': conv_id,
                    'messageText': raw_content[:2000],  # truncate for storage
                    'flagType': flag['flagType'],
                    'matched': flag.get('matched'),
                    'createdAt': datetime.utcnow(),
                })
            except Exception:
                # Never let a logging failure block the warning back to the user.
                pass
            raise HTTPException(
                status_code=422,
                detail={
                    'code': 'CONTACT_INFO_BLOCKED',
                    'flagType': flag['flagType'],
                    'reason': user_facing_reason(flag['flagType']),
                    'message': (
                        "For your safety and to keep your booking protected, "
                        "please don't share contact info here."
                    ),
                },
            )

    conversation = await db.conversations.find_one({
        'participants': {'$all': [sender_id, receiver_id]}
    })

    if not conversation:
        conversation_doc = {
            '_id': str(uuid.uuid4()),
            'participants': [sender_id, receiver_id],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        await db.conversations.insert_one(conversation_doc)
        conversation = conversation_doc

    message_doc = {
        '_id': str(uuid.uuid4()),
        'conversationId': str(conversation['_id']),
        'senderId': sender_id,
        'receiverId': receiver_id,
        'content': sanitize_text(message_data.content),
        'isRead': False,
        'createdAt': datetime.utcnow(),
    }

    await db.messages.insert_one(message_doc)

    await db.conversations.update_one(
        {'_id': conversation['_id']},
        {'$set': {'updatedAt': datetime.utcnow()}},
    )

    sender_name = current_user.get('fullName', 'Someone')
    preview = (message_doc['content'] or '')[:50]
    # iter97c (#3): when an admin sends a message, badge the push so users see
    # "RapidReps Support" as the sender (clearer than the raw admin name).
    is_admin_sender = bool(current_user.get('isAdmin'))
    title = (
        f"RapidReps Support replied"
        if is_admin_sender
        else f"New message from {sender_name}"
    )
    asyncio.create_task(create_and_send_notification(
        receiver_id,
        title,
        preview,
        "admin_reply" if is_admin_sender else "new_message",
        {
            "conversationId": str(conversation['_id']),
            "senderId": sender_id,
            "screen": "messages/chat",
            "isAdminReply": is_admin_sender,
        },
    ))

    return MessageResponse(
        id=str(message_doc['_id']),
        conversationId=str(message_doc['conversationId']),
        senderId=message_doc['senderId'],
        receiverId=message_doc['receiverId'],
        content=message_doc['content'],
        isRead=message_doc['isRead'],
        createdAt=message_doc['createdAt'],
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get all conversations for the current user (batched user/profile/last-message/unread queries)."""
    user_id = str(current_user['_id'])

    conversations_list = await db.conversations.find({'participants': user_id}).sort('updatedAt', -1).to_list(100)
    if not conversations_list:
        return []

    all_participant_ids = set()
    conversation_ids = []
    for conv in conversations_list:
        all_participant_ids.update(conv['participants'])
        conversation_ids.append(str(conv['_id']))

    users_cursor = db.users.find({'_id': {'$in': [ObjectId(pid) for pid in all_participant_ids]}})
    users_list = await users_cursor.to_list(len(all_participant_ids))
    users_map = {str(u['_id']): u for u in users_list}

    trainer_profiles = await db.trainer_profiles.find({'userId': {'$in': list(all_participant_ids)}}).to_list(len(all_participant_ids))
    trainee_profiles = await db.trainee_profiles.find({'userId': {'$in': list(all_participant_ids)}}).to_list(len(all_participant_ids))

    profiles_map: dict = {}
    for p in trainer_profiles:
        profiles_map[p['userId']] = p
    for p in trainee_profiles:
        if p['userId'] not in profiles_map:
            profiles_map[p['userId']] = p

    last_messages_pipeline = [
        {'$match': {'conversationId': {'$in': conversation_ids}}},
        {'$sort': {'createdAt': -1}},
        {'$group': {'_id': '$conversationId', 'lastMessage': {'$first': '$$ROOT'}}},
    ]
    last_messages_list = await db.messages.aggregate(last_messages_pipeline).to_list(len(conversation_ids))
    last_messages_map = {lm['_id']: lm['lastMessage'] for lm in last_messages_list}

    unread_counts_pipeline = [
        {'$match': {'conversationId': {'$in': conversation_ids}, 'receiverId': user_id, 'isRead': False}},
        {'$group': {'_id': '$conversationId', 'count': {'$sum': 1}}},
    ]
    unread_counts_list = await db.messages.aggregate(unread_counts_pipeline).to_list(len(conversation_ids))
    unread_counts_map = {uc['_id']: uc['count'] for uc in unread_counts_list}

    conversations = []
    for conv in conversations_list:
        participant_details = []
        for participant_id in conv['participants']:
            user = users_map.get(participant_id)
            if user:
                profile = profiles_map.get(participant_id)
                participant_details.append({
                    'id': participant_id,
                    'fullName': user.get('fullName', 'Unknown'),
                    'avatarUrl': profile.get('avatarUrl') or profile.get('profilePhoto') if profile else None,
                    'roles': user.get('roles', []),
                    # iter97d: expose isAdmin so the chat list can badge support conversations
                    'isAdmin': bool(user.get('isAdmin', False)),
                })

        conv_id_str = str(conv['_id'])
        last_message_doc = last_messages_map.get(conv_id_str)
        last_message = None
        if last_message_doc:
            last_message = {
                'content': last_message_doc['content'],
                'createdAt': last_message_doc['createdAt'].isoformat(),
                'senderId': last_message_doc['senderId'],
            }

        unread_count = unread_counts_map.get(conv_id_str, 0)

        conversations.append(ConversationResponse(
            id=conv_id_str,
            participants=conv['participants'],
            participantDetails=participant_details,
            lastMessage=last_message,
            unreadCount=unread_count,
            updatedAt=conv['updatedAt'],
        ))

    return conversations


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Get all messages in a conversation, marking unread received messages as read."""
    user_id = str(current_user['_id'])

    conversation = await db.conversations.find_one({'_id': conversation_id})
    if not conversation or user_id not in conversation['participants']:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")

    cursor = db.messages.find({'conversationId': conversation_id}).sort('createdAt', 1).limit(500)

    messages = []
    async for msg in cursor:
        messages.append(MessageResponse(
            id=str(msg['_id']),
            conversationId=msg['conversationId'],
            senderId=msg['senderId'],
            receiverId=msg['receiverId'],
            content=msg['content'],
            isRead=msg.get('isRead', False),
            createdAt=msg['createdAt'],
        ))

    await db.messages.update_many(
        {'conversationId': conversation_id, 'receiverId': user_id, 'isRead': False},
        {'$set': {'isRead': True}},
    )

    return messages


@router.post("/conversations")
async def get_or_create_conversation(receiver_id: str, current_user: dict = Depends(get_current_user)):
    """Get or create a conversation with another user."""
    sender_id = str(current_user['_id'])

    conversation = await db.conversations.find_one({
        'participants': {'$all': [sender_id, receiver_id]}
    })

    if conversation:
        return {'conversationId': str(conversation['_id'])}

    conversation_doc = {
        '_id': str(uuid.uuid4()),
        'participants': [sender_id, receiver_id],
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }
    await db.conversations.insert_one(conversation_doc)

    return {'conversationId': str(conversation_doc['_id'])}



@router.get("/messages/admin-contact")
async def get_admin_contact(current_user: dict = Depends(get_current_user)):
    """
    iter97 (#11): returns the admin user the trainee/trainer can message.
    Resolves the first active platform admin and ensures a conversation row
    exists between them and the caller.
    """
    user_id = str(current_user['_id'])
    # iter97 (#11): prefer the canonical admin account; fall back to any admin.
    admin = await db.users.find_one({"email": "admin@rapidreps.com", "isAdmin": True})
    if not admin:
        admin = await db.users.find_one({"isAdmin": True}, sort=[("createdAt", 1)])
    if not admin:
        raise HTTPException(status_code=503, detail="No admin available to message.")

    admin_id = str(admin['_id'])
    if admin_id == user_id:
        raise HTTPException(status_code=400, detail="Admins cannot message themselves.")

    conversation = await db.conversations.find_one({
        'participants': {'$all': [user_id, admin_id]}
    })
    if not conversation:
        conversation_doc = {
            '_id': str(uuid.uuid4()),
            'participants': [user_id, admin_id],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        await db.conversations.insert_one(conversation_doc)
        conv_id = conversation_doc['_id']
    else:
        conv_id = str(conversation['_id'])

    return {
        "conversationId": conv_id,
        "admin": {
            "id": admin_id,
            "fullName": admin.get('fullName', 'RapidReps Admin'),
            "email": admin.get('email', ''),
            "avatarUrl": admin.get('avatarUrl'),
        },
    }
