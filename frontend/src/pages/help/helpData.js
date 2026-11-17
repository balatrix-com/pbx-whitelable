export const HELP_CATEGORIES = [
    { id: 'all', label: 'All Topics', icon: 'HelpCircle' },
    { id: 'platform', label: 'Platform & Tenants', icon: 'Building2', role: 'SUPER_ADMIN' },
    { id: 'carriers', label: 'Carriers & Traces', icon: 'RadioTower', role: 'SUPER_ADMIN' },
    { id: 'pricing', label: 'Rate Cards & Plans', icon: 'CreditCard', role: 'SUPER_ADMIN' },
    { id: 'extensions', label: 'Softphones & Extensions', icon: 'Smartphone', role: 'TENANT' },
    { id: 'calls', label: 'Calling & Inbound Routing', icon: 'PhoneCall', role: 'TENANT' },
    { id: 'audio', label: 'Audio & Headset', icon: 'Headphones', role: 'TENANT' },
    { id: 'features', label: 'IVR, Schedules & Forwards', icon: 'ListTree', role: 'TENANT' },
    { id: 'account', label: 'Account & Wallet', icon: 'Wallet', role: 'TENANT' },
];

export const HELP_ARTICLES = [
    // ==========================================
    // --- Super Admin Guides (12 Guides) ---
    // ==========================================
    {
        id: 'super-admin-tenant-blocked',
        category: 'platform',
        roles: ['SUPER_ADMIN'],
        title: 'Tenant Service Blocked or Inactive: How to Inspect & Reactivate',
        summary: 'A tenant client organization cannot place or receive calls due to billing lock, suspension, or manual service block.',
        steps: [
            'Go to Tenants in the main sidebar to open the Tenant Ecosystem overview.',
            'Locate the affected tenant organization by company name or customer ID (e.g., U1001).',
            'Check the Service Status column badge: if marked as "Service Blocked", the tenant has either breached credit thresholds or was administratively paused.',
            'Click Configure or the quick unblock toggle button to manage their enforcement status and restore real-time calling.',
            'If the block is caused by wallet depletion, you can manually adjust their prepaid balance or raise their credit limit under their wallet management profile.'
        ],
        action: {
            label: 'Open Tenants Ecosystem',
            path: '/tenants'
        },
        techSnippet: {
            label: 'Service Status Path',
            value: '/tenants'
        },
        tags: ['tenant', 'blocked', 'reactivate', 'suspend', 'credit limit', 'super admin', 'organization']
    },
    {
        id: 'super-admin-carrier-gateway-down',
        category: 'carriers',
        roles: ['SUPER_ADMIN'],
        title: 'SIP Trunk / Upstream Carrier Gateway Registration Failure',
        summary: 'Inbound or outbound carrier interconnect shows down, fails ping healthcheck, or rejects SIP INVITEs with 403/503.',
        steps: [
            'Navigate to Carriers & Gateways in the sidebar.',
            'Inspect the Gateway State: check whether your Telnyx, Twilio, or custom Kamailio/FreeSWITCH SIP Trunk is reporting "REG_STATE_REGISTERED" or "FAILED".',
            'Verify Authentication: check whether IP ACL (whitelisting) or SIP digest credentials (username/password) match upstream carrier portal settings.',
            'Review Codec Negotiation: confirm carrier profile supports PCMU (G.711u), PCMA (G.711a), or G.722, and ensure RTP NAT traversal is enabled.',
            'Open SIP Traces in the platform menu to inspect live SIP signaling ladder and response codes (e.g. 401 Unauthorized, 403 Forbidden, 488 Not Acceptable Here).'
        ],
        action: {
            label: 'Manage Carriers & Gateways',
            path: '/super-admin/carriers'
        },
        techSnippet: {
            label: 'SIP Diagnostic Tool',
            value: '/super-admin/sip-traces'
        },
        tags: ['carrier', 'gateway', 'trunk', 'sip', 'telnyx', 'twilio', 'kamailio', 'super admin', 'interconnect']
    },
    {
        id: 'super-admin-sip-traces-homer',
        category: 'carriers',
        roles: ['SUPER_ADMIN'],
        title: 'Troubleshooting Call Failures using Homer SIP Ladder Traces',
        summary: 'Diagnose intermittent call drops, 500 Server Errors, 408 Timeouts, or missing B-legs across the entire platform.',
        steps: [
            'Open SIP Traces from the Super Admin sidebar.',
            'Set the "From" and "To" datetime boundaries and optionally enter the Customer Code (e.g. U1001) or specific phone number / Call-ID.',
            'Click Search to fetch indexed call signaling captured by Kamailio and HEP agent.',
            'Click "Open trace" on the target call row to view the interactive SIP Ladder flow diagram between caller, Kamailio proxy, FreeSWITCH media engine, and carrier gateway.',
            'Click on any individual SIP message (INVITE, 100 Trying, 180 Ringing, 200 OK, BYE) to inspect raw SIP headers, SDP payload, and RTP codec negotiation.'
        ],
        action: {
            label: 'Open SIP Traces',
            path: '/super-admin/sip-traces'
        },
        techSnippet: {
            label: 'Capture Protocol',
            value: 'HEPv3 / Homer Capture'
        },
        tags: ['sip trace', 'homer', 'call-id', 'ladder', 'packet', 'freeswitch', 'kamailio', 'super admin', 'debug']
    },
    {
        id: 'super-admin-rate-cards-billing',
        category: 'pricing',
        roles: ['SUPER_ADMIN'],
        title: 'Managing Rate Cards, Billing Markups & Custom Destination Rates',
        summary: 'Calls failing with "No Route" or incorrect per-minute rates calculated for specific tenant tiers.',
        steps: [
            'Navigate to Rate Cards in the Super Admin sidebar.',
            'Verify that the tenant organization has an active assigned rate card (Standard, Enterprise, Wholesale).',
            'Check Prefix & Destination Matching: ensure country codes and regional prefixes (e.g. +1 for US/Canada, +44 for UK) have positive per-minute sell rates configured.',
            'Review Margin / Markup settings: confirm that call cost calculation is properly capturing the carrier wholesale cost plus your platform margin percentage.',
            'Test rate lookup by running a simulation query for the dialed country and check CDR logs for accurate rating.'
        ],
        action: {
            label: 'Manage Rate Cards',
            path: '/super-admin/rate-cards'
        },
        tags: ['rate card', 'billing', 'rates', 'pricing', 'call cost', 'margin', 'super admin']
    },
    {
        id: 'super-admin-number-inventory-did-tfn',
        category: 'platform',
        roles: ['SUPER_ADMIN'],
        title: 'Number Inventory: Assigning, Provisioning & Unassigning DIDs and TFNs',
        summary: 'How to manage the global pool of Toll-Free (TFN) and Direct Dial (DID) numbers across tenants.',
        steps: [
            'Go to Manage Numbers in the sidebar to open the Number Inventory.',
            'Use the Toll-Free (TFN) and Direct Dial (DID) tabs to browse available vs assigned phone numbers.',
            'Filter by "Available TFNs" to quickly locate unassigned toll-free inventory ready for allocation.',
            'To assign a number to a tenant, click the Link / Assign icon, select the customer organization from the dropdown, and confirm.',
            'To release a number back to the general inventory pool, click the Unlink icon (the tenant loses routing access immediately).'
        ],
        action: {
            label: 'Open Number Inventory',
            path: '/super-admin/numbers'
        },
        tags: ['numbers', 'did', 'tfn', 'inventory', 'provisioning', 'assign', 'super admin', 'toll-free']
    },
    {
        id: 'super-admin-audit-logs',
        category: 'platform',
        roles: ['SUPER_ADMIN'],
        title: 'Tracking Admin Activities & Security Events in Audit Logs',
        summary: 'Inspect who created plans, changed gateway credentials, assigned phone numbers, or impersonated users.',
        steps: [
            'Open Audit Logs in the Super Admin sidebar.',
            'Use the search filter to track specific actor emails, actions (e.g. TENANT_BLOCKED, USER_IMPERSONATE, RATE_CARD_UPDATED), or target resources.',
            'Check timestamps, client IP addresses, and detailed JSON metadata payloads for compliance and diagnostic tracking.',
            'Filter by specific tenant customer code to isolate actions taken within that organization.'
        ],
        action: {
            label: 'View Audit Logs',
            path: '/admin/audit-logs'
        },
        tags: ['audit', 'logs', 'security', 'impersonate', 'compliance', 'super admin', 'tracking']
    },
    {
        id: 'super-admin-tenant-impersonation',
        category: 'platform',
        roles: ['SUPER_ADMIN'],
        title: 'Tenant Account Impersonation & On-Behalf Troubleshooting',
        summary: 'How Super Admins can safely inspect and resolve configurations inside a specific tenant PBX account.',
        steps: [
            'Navigate to Tenants page in the Super Admin sidebar.',
            'Locate the customer organization and click "Configure" or use the quick Impersonate action from User Management.',
            'A yellow/orange Impersonation Banner will pin to the top of your screen indicating you are acting as that organization.',
            'Test the customer extension configuration, IVR menus, ring groups, and schedules directly inside their workspace.',
            'When finished, click "Exit Impersonation" on the top banner to return immediately to your Super Admin platform dashboard.'
        ],
        action: {
            label: 'Open Tenants List',
            path: '/tenants'
        },
        tags: ['impersonation', 'tenant', 'troubleshoot', 'support', 'banner', 'super admin']
    },
    {
        id: 'super-admin-extension-status-kamailio',
        category: 'carriers',
        roles: ['SUPER_ADMIN'],
        title: 'Global Extension Registration & Kamailio Location Table Diagnostics',
        summary: 'Identify extensions registered across all tenants, detecting rogue IPs, expired NAT contacts, or failed SIP registration sweeps.',
        steps: [
            'Go to Extension Status in the sidebar (under Super Admin menu).',
            'View the live table populated from Kamailio usrloc in-memory database.',
            'Filter by Tenant Customer Code, extension number, or registered remote IP.',
            'Check the User-Agent header (Zoiper, MicroSIP, Yealink, Linphone) to ensure authorized softphone clients are being used.',
            'Verify the Expires time and NAT Contact string: if the contact shows private IP without received IP, NAT traversal (fix_nated_register) may have failed.'
        ],
        action: {
            label: 'View Extension Status',
            path: '/admin/extension-status'
        },
        tags: ['extension status', 'kamailio', 'usrloc', 'registration', 'sip', 'nat', 'super admin']
    },
    {
        id: 'super-admin-plans-packages',
        category: 'pricing',
        roles: ['SUPER_ADMIN'],
        title: 'Configuring Subscription Plans, Packages & Feature Limits',
        summary: 'Set up tiered monthly plans (e.g., Starter, Professional, Enterprise) and define extension/DID quotas.',
        steps: [
            'Navigate to Plans under the Super Admin sidebar.',
            'Click "Create Plan" or select an existing plan to modify its billing parameters.',
            'Configure recurring fee, billing interval (Monthly / Annual), and included asset quotas (Extensions, DIDs, TFNs, Call Recording).',
            'Set overage pricing for additional extensions or usage minutes exceeding plan allowances.',
            'Publish the plan to make it selectable for new tenant signups or automated self-service upgrades.'
        ],
        action: {
            label: 'Manage Plans',
            path: '/super-admin/plans'
        },
        tags: ['plans', 'packages', 'subscriptions', 'quotas', 'billing', 'pricing', 'super admin']
    },
    {
        id: 'super-admin-addons-management',
        category: 'pricing',
        roles: ['SUPER_ADMIN'],
        title: 'Managing Add-ons & Extra Capacity Services',
        summary: 'Provision and configure recurring or metered add-ons such as Call Monitoring, Storage, or AI Transcription.',
        steps: [
            'Open Add-ons in the Super Admin sidebar.',
            'Review active add-on catalog items and their billing models (Flat fee, Per-seat, or Usage-based).',
            'Configure provision hooks: ensure add-ons linked to FreeSWITCH features (like eavesdrop/call monitoring) enable the corresponding user permissions.',
            'Check tenant subscription attachments to see which customer organizations have enabled specific add-ons.',
            'Adjust pricing or archive outdated add-on items without disrupting existing subscribed tenants.'
        ],
        action: {
            label: 'Manage Add-ons',
            path: '/super-admin/addons'
        },
        tags: ['add-ons', 'monitoring', 'storage', 'catalog', 'subscriptions', 'super admin']
    },
    {
        id: 'super-admin-call-monitoring-eavesdrop',
        category: 'carriers',
        roles: ['SUPER_ADMIN'],
        title: 'Platform Call Monitoring: Real-time Channel Eavesdrop & Whisper Debugging',
        summary: 'Troubleshooting live channel monitoring, coach, barge-in, or audio stream attachments.',
        steps: [
            'Go to Call Monitoring in the sidebar to view all active calls running across the platform.',
            'Verify that FreeSWITCH ESL socket connection is active and streaming live channel events.',
            'Identify the target call channel UUID and active extensions.',
            'To listen into a live call, ensure your monitoring extension has the Call Monitoring add-on permission flag enabled.',
            'Check RTP packet stats: verify jitter, packet loss percentage, and round-trip delay to evaluate live voice quality across carrier legs.'
        ],
        action: {
            label: 'Open Call Monitoring',
            path: '/monitoring'
        },
        tags: ['call monitoring', 'eavesdrop', 'whisper', 'barge', 'esl', 'freeswitch', 'super admin']
    },
    {
        id: 'super-admin-branding-whitelabel',
        category: 'platform',
        roles: ['SUPER_ADMIN'],
        title: 'System Settings: White-Label Branding, Logos & Custom Domain Setup',
        summary: 'Customizing tenant partner branding, custom portal logo, favicon, and system email sender domains.',
        steps: [
            'Open System Settings from the Super Admin sidebar.',
            'Upload primary and sidebar logo images (PNG or SVG format recommended with transparent background).',
            'Set custom application title, company name, and favicon icon.',
            'Configure outgoing SMTP credentials and Default From Email so automated notifications and password resets carry your custom domain identity.',
            'Save changes: branding updates propagate across tenant login pages, navbar header, and email templates immediately.'
        ],
        action: {
            label: 'System Settings',
            path: '/settings'
        },
        tags: ['branding', 'whitelabel', 'logo', 'favicon', 'smtp', 'domain', 'super admin']
    },

    // ==========================================
    // --- Admin & Tenant Guides (12 Guides) ---
    // ==========================================
    {
        id: 'extension-offline',
        category: 'extensions',
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
        roles: ['ADMIN', 'SUPPORT'],
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
    },
    {
        id: 'ring-groups-setup-strategy',
        category: 'calls',
        roles: ['ADMIN', 'SUPPORT'],
        title: 'Configuring Ring Groups, Ring Strategies & Fallback Destinations',
        summary: 'Distribute calls simultaneously or sequentially among team extensions, with failover if no agent answers.',
        steps: [
            'Navigate to Ring Groups in the sidebar and click "Create Ring Group".',
            'Assign a Group Extension (e.g., 2000) and choose a Ring Strategy: Ring All (simultaneous), Hunt / Round Robin, or Sequential.',
            'Add extension members to the group and set the Ring Timeout (default: 20-30 seconds).',
            'Configure the "Timeout / No-Answer Destination" (e.g. forward to Voicemail, an external phone number, or an IVR menu) so callers are never disconnected.',
            'Link your phone number on the Phone Numbers page to point inbound calls to this Ring Group.'
        ],
        action: {
            label: 'Manage Ring Groups',
            path: '/telecom/ring-groups'
        },
        tags: ['ring groups', 'hunt', 'simultaneous', 'timeout', 'failover', 'extensions', 'calls']
    },
    {
        id: 'schedules-business-hours-holidays',
        category: 'features',
        roles: ['ADMIN', 'SUPPORT'],
        title: 'Setting Business Hours, Holiday Rules & After-Hours Call Routing',
        summary: 'Ensure incoming customer calls route to office staff during business hours and to after-hours voicemail or an emergency forward when closed.',
        steps: [
            'Open Schedules in the main sidebar and click "New Schedule".',
            'Define your Weekly Schedule: select active work days (Monday - Friday) and set opening and closing hours (e.g., 09:00 AM - 05:00 PM).',
            'Set In-Hours Destination: choose where calls go during open hours (e.g., Primary Ring Group or IVR).',
            'Set Out-of-Hours Destination: choose where calls route when the office is closed (e.g., Night IVR or After-Hours Voicemail).',
            'Add Custom Holiday Exceptions: specify calendar dates (e.g. New Year, Christmas) with custom holiday greetings or forward destinations.'
        ],
        action: {
            label: 'Manage Schedules',
            path: '/telecom/schedules'
        },
        tags: ['schedules', 'business hours', 'holidays', 'after-hours', 'routing', 'night service']
    }
];
