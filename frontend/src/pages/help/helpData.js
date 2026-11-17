export const HELP_CATEGORIES = [
    { id: 'all', label: 'All Topics', icon: 'HelpCircle' },
    { id: 'extensions', label: 'Softphones & Extensions', icon: 'Smartphone' },
    { id: 'calls', label: 'Calling & Inbound Routing', icon: 'PhoneCall' },
    { id: 'audio', label: 'Audio & Headset', icon: 'Headphones' },
    { id: 'features', label: 'IVR, Schedules & Forwards', icon: 'ListTree' },
    { id: 'account', label: 'Account & Wallet', icon: 'Wallet' },
];

export const HELP_ARTICLES = [
    {
        id: 'extension-offline',
        category: 'extensions',
        title: 'Extension shows "Offline" or Unregistered',
        summary: 'Your softphone app or SIP desk phone is disconnected from the PBX server.',
        steps: [
            'Check that your softphone app (Zoiper, Linphone, MicroSIP) is actively running on your device and not closed or sleeping in the background.',
            'Confirm that your computer or mobile device has an active, stable internet connection.',
            'Double-check your SIP credentials in the softphone settings. The Username must match your Extension Number, and the Password must match your Extension Secret.',
            'Verify that the SIP Domain / Hostname is typed correctly without any extra spaces, "http://", or "https://" prefixes.',
            'If using a mobile softphone on cellular data, ensure cellular data access is permitted for the app in your phone settings.'
        ],
        action: {
            label: 'Check Extension Status',
            path: '/extensions/status'
        },
        techSnippet: {
            label: 'Standard SIP Port',
            value: '5060'
        },
        tags: ['offline', 'unregistered', 'extension', 'softphone', 'zoiper', 'linphone', 'microsip']
    },
    {
        id: 'softphone-configuration',
        category: 'extensions',
        title: 'How to configure a Softphone (Zoiper, Linphone, MicroSIP)',
        summary: 'Step-by-step setup guide for connecting standard SIP dialers on desktop or mobile.',
        steps: [
            'Go to Extension Settings in the left sidebar and locate your extension number.',
            'Open the extension to view or copy your SIP Username (Extension Number) and SIP Secret (Password).',
            'Open your softphone application and choose "Add SIP Account".',
            'Enter your Account Name (e.g., "Office PBX"), Domain / Registrar (your PBX host domain), Username (Extension number), and Password (Extension secret).',
            'Set Transport to UDP and Port to 5060 unless TLS encryption was specifically configured for your tenant.',
            'Save the account. The registration status indicator should turn green within a few seconds.'
        ],
        action: {
            label: 'View Extension Settings',
            path: '/extensions'
        },
        techSnippet: {
            label: 'Default Transport',
            value: 'UDP / Port 5060'
        },
        tags: ['setup', 'configure', 'softphone', 'zoiper', 'linphone', 'credentials', 'sip secret']
    },
    {
        id: 'inbound-calls-not-ringing',
        category: 'calls',
        title: 'Inbound calls are not ringing my extension',
        summary: 'Incoming calls either drop, play after-hours messages, or go straight to voicemail.',
        steps: [
            'Check Operational Time (Schedules): Open Schedules in the sidebar to see if your phone numbers are currently following an After-Hours or Holiday rule.',
            'Verify Ring Group Membership: If incoming calls route to a Ring Group, confirm that your extension is added to that Ring Group and that the ring strategy is active.',
            'Verify Phone Number (DID) Routing: Check the Phone Numbers page to confirm the incoming phone number is assigned to the correct destination (your extension, ring group, or IVR).',
            'Verify Extension Registration: Open Extension Status to ensure your extension is showing as Online (Green indicator).'
        ],
        action: {
            label: 'View Schedules & Business Hours',
            path: '/telecom/schedules'
        },
        tags: ['inbound', 'ringing', 'schedule', 'ring group', 'did', 'routing', 'voicemail']
    },
    {
        id: 'outbound-call-fails',
        category: 'calls',
        title: 'Outbound calls fail immediately or drop upon dialing',
        summary: 'When dialing out, you immediately receive a fast busy tone or a "Call Failed" prompt.',
        steps: [
            'Check your Prepaid Wallet Balance: Outbound calling requires an active balance. If your balance is $0.00 or below the minimum threshold, outbound calls are blocked automatically.',
            'Check the Dialed Number Format: Ensure you dial standard 10-digit format for US/Canada (or 11 digits starting with 1). For international destinations, dial with the "+" prefix and country code.',
            'Check Destination Coverage: Ensure the country you are calling is supported by your tenant rate card.',
            'Confirm your softphone has microphone access so the call can establish an audio channel.'
        ],
        action: {
            label: 'Check Wallet Balance',
            path: '/wallet'
        },
        tags: ['outbound', 'failed', 'wallet', 'balance', 'dropped', 'fast busy', 'dialing']
    },
    {
        id: 'no-audio-mic-issue',
        category: 'audio',
        title: 'No audio or caller cannot hear me (Microphone permissions)',
        summary: 'Call connects, but there is silence or the other party cannot hear your voice.',
        steps: [
            'Check Browser Permissions: If using a WebRTC web dialer, click the Lock icon (🔒) in your browser address bar and verify that "Microphone" is set to "Allow".',
            'Check Default Operating System Audio Device: Open your computer sound settings (Windows / macOS) and confirm that your headset is set as the Default Input and Output device.',
            'Check Physical Mute Buttons: Ensure the hardware mute switch on your headset cord or wireless headset is turned off.',
            'Softphone Audio Settings: If using desktop Zoiper or MicroSIP, go to Audio Settings and explicitly select your headset device instead of leaving it on "Default".'
        ],
        action: null,
        tags: ['audio', 'microphone', 'mic', 'silence', 'headset', 'permissions', 'webrtc']
    },
    {
        id: 'one-way-audio-nat',
        category: 'audio',
        title: 'One-Way Audio: You hear the caller, but they cannot hear you',
        summary: 'Audio transmits in only one direction due to local router firewall or NAT translation.',
        steps: [
            'Turn OFF SIP ALG on your local office router: Almost all commercial routers have a feature called "SIP ALG" (Application Layer Gateway) enabled by default. This feature inspects and frequently corrupts VoIP packets. Disabling SIP ALG in your router settings resolves most one-way audio issues.',
            'Enable STUN Server in Softphone: Open your softphone network settings, enable STUN, and set the STUN host to stun.l.google.com:19302.',
            'Try switching transport: In your softphone account settings, try switching transport from UDP to TCP or TLS if supported by your provider.',
            'Avoid double-NAT: If your computer is connected behind two chained routers, connect directly to the primary router or switch to wired Ethernet.'
        ],
        action: null,
        techSnippet: {
            label: 'Public STUN Server',
            value: 'stun.l.google.com:19302'
        },
        tags: ['one-way audio', 'nat', 'stun', 'sip alg', 'firewall', 'router', 'choppy']
    },
    {
        id: 'ivr-audio-prompt-silent',
        category: 'features',
        title: 'IVR greeting or Auto-Attendant prompt is silent',
        summary: 'Callers reach your IVR menu, but hear no voice greeting before pressing key options.',
        steps: [
            'Open Audio Library in the sidebar and verify that your custom greeting file is uploaded and marked as ready.',
            'Check Audio File Format: Custom prompts must be standard WAV or MP3 files. Recommended standard: PCM 16-bit, 8000 Hz or 16000 Hz, Mono WAV.',
            'Verify IVR Assignment: Go to IVR Menus, click your menu, and confirm that the greeting audio file is selected in the "Greeting Prompt" dropdown.',
            'Set Timeout Handling: Confirm that an invalid/timeout action (such as forwarding to an extension or ring group) is configured so callers are not dropped if they do not dial a digit.'
        ],
        action: {
            label: 'Open Audio Library',
            path: '/telecom/audio'
        },
        tags: ['ivr', 'greeting', 'prompt', 'audio library', 'auto attendant', 'recording', 'wav']
    },
    {
        id: 'did-forward-not-working',
        category: 'features',
        title: 'Call Forwarding / DID Forward not reaching external cell phone',
        summary: 'Calls routed to an external mobile or landline number do not complete.',
        steps: [
            'Verify Forward Destination Format: Open DID Forwards in the sidebar and check the destination number. Enter standard E.164 format with country code (e.g., +14155550199) with no spaces or dashes.',
            'Check Wallet Balance: Forwarding an inbound call to an external phone number creates an outbound call leg billed against your tenant wallet. Your wallet must have an active balance.',
            'Check Inbound Routing: Confirm that the phone number on the Phone Numbers page has its route set to the DID Forward rule you created.',
            'Ensure the destination cell phone is not blocking unknown numbers or marked as spam by your mobile carrier.'
        ],
        action: {
            label: 'Manage DID Forwards',
            path: '/telecom/did-forwards'
        },
        tags: ['forward', 'did forward', 'cell phone', 'mobile', 'redirect', 'wallet']
    },
    {
        id: 'team-member-password-reset',
        category: 'account',
        title: 'A team member cannot log in or forgot their password',
        summary: 'Quickly restore portal access for agents and team members.',
        steps: [
            'As an Admin, navigate to User Management in the sidebar.',
            'Find the user in the list and click the edit/actions menu.',
            'You can trigger a password reset or assign a new temporary password for their account.',
            'Ensure their account status is set to "Active" and not marked as disabled or suspended.',
            'Users can also use the "Forgot Password" link directly on the portal login screen to receive a secure reset link.'
        ],
        action: {
            label: 'Open User Management',
            path: '/users'
        },
        tags: ['password', 'login', 'account', 'users', 'reset', 'credentials', 'access']
    },
    {
        id: 'wallet-top-up-billing',
        category: 'account',
        title: 'How to add funds and manage auto-recharge in Wallet',
        summary: 'Keep your prepaid balance topped up to avoid any outbound calling disruption.',
        steps: [
            'Open the Wallet page from the main sidebar.',
            'Review your current Available Balance and recent call charges in the ledger.',
            'Click "Add Funds" / "Top Up" to add balance using your saved credit card or payment method.',
            'Enable low-balance email alerts so you are notified before your balance runs low.'
        ],
        action: {
            label: 'Open Wallet',
            path: '/wallet'
        },
        tags: ['wallet', 'funds', 'top up', 'recharge', 'payment', 'balance', 'credit card']
    }
];
