import { useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Send, Paperclip, Smile, MoreVertical, Phone, Mail, MessageSquare } from 'lucide-react';

function InboxLayout({ channelLabel, channelIcon: ChannelIcon, contacts, messages: defaultMessages }) {
  const [activeContact, setActiveContact] = useState(0);
  const [messageText, setMessageText] = useState('');

  const handleSend = () => {
    if (!messageText.trim()) { toast.error('Please type a message'); return; }
    toast.success('Message sent');
    setMessageText('');
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col md:flex-row bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Contact List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col max-h-[35vh] md:max-h-none">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <ChannelIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-900 dark:text-white">{channelLabel}</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search conversations..." className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm dark:text-white" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map((c, i) => (
            <div
              key={i}
              onClick={() => setActiveContact(i)}
              className={`p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer ${activeContact === i ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                    <span className="text-xs text-slate-400 shrink-0">{c.time}</span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && (
                  <span className="w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center shrink-0">{c.unread}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-medium">
              {contacts[activeContact]?.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{contacts[activeContact]?.name}</p>
              <p className="text-xs text-slate-500">{contacts[activeContact]?.phone || contacts[activeContact]?.email || 'Online'}</p>
            </div>
          </div>
          <button onClick={() => toast.success('Conversation options')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 space-y-3">
          {defaultMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${msg.isOwn ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'}`}>
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${msg.isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => toast('Attach files coming soon', { icon: 'i' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Paperclip className="w-5 h-5 text-slate-500" /></button>
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm dark:text-white"
            />
            <button onClick={() => toast('Emoji picker coming soon', { icon: 'i' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Smile className="w-5 h-5 text-slate-500" /></button>
            <button onClick={handleSend} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

const whatsappContacts = [
  { name: 'Rajesh Kumar', lastMessage: 'Thanks for the demo!', time: '2m', unread: 2, phone: '+91 98765 43210' },
  { name: 'Priya Sharma', lastMessage: 'Can you send pricing?', time: '15m', unread: 1, phone: '+91 87654 32109' },
  { name: 'Vikram Patel', lastMessage: 'Meeting confirmed for tomorrow', time: '1h', unread: 0, phone: '+91 76543 21098' },
  { name: 'Anita Desai', lastMessage: 'I need help with integration', time: '3h', unread: 0, phone: '+91 65432 10987' },
];

const smsContacts = [
  { name: 'Tech Solutions', lastMessage: 'OTP: 456789', time: '5m', unread: 1, phone: '+91 98765 11111' },
  { name: 'Suresh Mehta', lastMessage: 'Appointment confirmed', time: '30m', unread: 0, phone: '+91 87654 22222' },
  { name: 'Kavita Joshi', lastMessage: 'Your order has shipped', time: '2h', unread: 0, phone: '+91 76543 33333' },
];

const emailContacts = [
  { name: 'Rajesh Kumar', lastMessage: 'RE: Product Demo Follow-up', time: '10m', unread: 3, email: 'rajesh@example.com' },
  { name: 'Tech Solutions', lastMessage: 'Partnership Proposal', time: '1h', unread: 1, email: 'info@techsolutions.com' },
  { name: 'Priya Sharma', lastMessage: 'Invoice #1234', time: '4h', unread: 0, email: 'priya@example.com' },
  { name: 'Support Team', lastMessage: 'Ticket #TKT-001 update', time: '1d', unread: 0, email: 'support@company.com' },
];

const whatsappMessages = [
  { text: 'Hi! I saw your Voice AI demo. Very impressive!', time: '10:30 AM', isOwn: false },
  { text: 'Thank you! Would you like a personalized demo?', time: '10:32 AM', isOwn: true },
  { text: 'Yes, that would be great! Can we schedule for tomorrow?', time: '10:35 AM', isOwn: false },
  { text: 'Sure! I have slots at 10 AM and 2 PM. Which works?', time: '10:36 AM', isOwn: true },
  { text: '2 PM works perfectly. Thanks!', time: '10:38 AM', isOwn: false },
  { text: 'Booked! You\'ll receive a calendar invite shortly.', time: '10:39 AM', isOwn: true },
  { text: 'Thanks for the demo!', time: '3:15 PM', isOwn: false },
];

const smsMessages = [
  { text: 'Your appointment is confirmed for Feb 26 at 2:00 PM.', time: '9:00 AM', isOwn: true },
  { text: 'Thank you! Will be there.', time: '9:05 AM', isOwn: false },
  { text: 'Reminder: Your appointment is tomorrow at 2:00 PM.', time: '4:00 PM', isOwn: true },
  { text: 'OTP: 456789', time: '4:30 PM', isOwn: true },
];

const emailMessages = [
  { text: 'Hi Rajesh,\n\nThank you for attending the demo today. As discussed, I\'m sharing the pricing details...', time: '10:00 AM', isOwn: true },
  { text: 'Thanks for sharing! The Enterprise plan looks interesting. Can we discuss custom features?', time: '11:30 AM', isOwn: false },
  { text: 'Absolutely! I\'ll set up a call with our solutions team. Would Thursday work?', time: '11:45 AM', isOwn: true },
  { text: 'Thursday at 3 PM works. Looking forward to it!', time: '12:00 PM', isOwn: false },
];

export function WhatsAppInboxPage() {
  return <InboxLayout channelLabel="WhatsApp" channelIcon={MessageSquare} contacts={whatsappContacts} messages={whatsappMessages} />;
}

export function SMSInboxPage() {
  return <InboxLayout channelLabel="SMS" channelIcon={Phone} contacts={smsContacts} messages={smsMessages} />;
}

export function EmailInboxPage() {
  return <InboxLayout channelLabel="Email" channelIcon={Mail} contacts={emailContacts} messages={emailMessages} />;
}
