/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                GOOGLE-SERVICES.TSX - GOOGLE WORKSPACE DASHBOARD               ║
 * ║                                                                               ║
 * ║  A comprehensive dashboard for interacting with Google Workspace services:   ║
 * ║                                                                               ║
 * ║    1. Google Drive - Browse, search, and open files                          ║
 * ║    2. Gmail - Read emails and compose new messages                           ║
 * ║    3. Google Calendar - View and create events                               ║
 * ║    4. Google Docs - View and create documents                                ║
 * ║    5. Google Sheets - View and create spreadsheets                           ║
 * ║    6. Google Tasks - Manage task lists and tasks                             ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Header: [← Back to Chat] Google Workspace                              │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │ Tabs: [Drive] [Gmail] [Calendar] [Docs] [Sheets] [Tasks]               │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │                                                                        │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ Panel Content (varies by selected tab)                           │  │  ║
 * ║  │  │ - Search/filter                                                  │  │  ║
 * ║  │  │ - Action buttons (Create, Refresh)                               │  │  ║
 * ║  │  │ - Scrollable list of items                                       │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────────┘  │  ║
 * ║  │                                                                        │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage component state for forms and UI
 */
import { useState } from 'react';

/**
 * TanStack Query (React Query)
 * - useQuery: Fetch and cache data from APIs
 * - useMutation: Handle data mutations (POST, PUT, DELETE)
 * - useQueryClient: Access query cache for invalidation
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * shadcn/ui Components
 * - Card: Container components for content
 * - Button: Consistent styled buttons
 * - Input: Text input fields
 * - Textarea: Multi-line text input
 * - Tabs: Tab navigation component
 * - ScrollArea: Scrollable container with custom scrollbar
 * - Badge: Status/label badges
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

/**
 * Custom Toast Hook for notifications
 */
import { useToast } from '@/hooks/use-toast';

/**
 * Lucide Icons
 * - Service icons for each Google service
 * - Action icons for buttons
 */
import { 
  FolderOpen,      // Google Drive icon
  Mail,            // Gmail icon
  Calendar,        // Google Calendar icon
  FileText,        // Google Docs icon
  Table2,          // Google Sheets icon
  CheckSquare,     // Google Tasks icon
  RefreshCw,       // Refresh/reload icon
  Plus,            // Create/add icon
  ExternalLink,    // Open in new tab icon
  Send,            // Send email icon
  ArrowLeft        // Back navigation icon
} from 'lucide-react';

/**
 * Wouter Link for navigation
 */
import { Link } from 'wouter';

// ============================================================================
// GOOGLE DRIVE PANEL COMPONENT
// ============================================================================

/**
 * DrivePanel - Google Drive File Browser
 * 
 * Displays a list of files from Google Drive with search functionality.
 * 
 * Features:
 * - List recent files from Drive
 * - Search files by name
 * - Open files in Google Drive web interface
 * - Refresh file list
 * 
 * API Endpoints Used:
 * - GET /api/drive/files - List files
 * - GET /api/drive/search?q=query - Search files
 * 
 * @returns {JSX.Element} Drive panel component
 */
function DrivePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  /**
   * Search query state
   * When empty, shows recent files; when filled, shows search results
   */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Query: Fetch list of Drive files
   * Fetches recent files from the user's Google Drive
   */
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/drive/files'],
    queryFn: () => fetch('/api/drive/files').then(res => res.json()),
  });

  /**
   * Query: Search Drive files
   * Only enabled when searchQuery is not empty
   */
  const searchFiles = useQuery({
    queryKey: ['/api/drive/search', searchQuery],
    queryFn: () => fetch(`/api/drive/search?q=${encodeURIComponent(searchQuery)}`).then(res => res.json()),
    enabled: !!searchQuery, // Only run when search query exists
  });

  // Use search results if searching, otherwise show all files
  const displayFiles = searchQuery ? (searchFiles.data || []) : files;

  return (
    <div className="space-y-4">
      {/* Search and Refresh Controls */}
      <div className="flex gap-2">
        <Input
          data-testid="input-drive-search"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button data-testid="button-drive-refresh" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Scrollable File List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground">Loading files...</p>
          ) : displayFiles.length === 0 ? (
            <p className="text-muted-foreground">No files found</p>
          ) : (
            displayFiles.map((file: any) => (
              <Card key={file.id} data-testid={`card-drive-file-${file.id}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* File type icon from Google */}
                    <img src={file.iconLink} alt="" className="w-5 h-5" />
                    <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                  </div>
                  {/* Open in Drive button */}
                  {file.webViewLink && (
                    <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                      <Button data-testid={`button-open-drive-${file.id}`} variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// GMAIL PANEL COMPONENT
// ============================================================================

/**
 * GmailPanel - Gmail Email Client
 * 
 * Displays emails and allows composing new messages.
 * 
 * Features:
 * - List recent emails
 * - View email subject, sender, and snippet
 * - Compose and send new emails
 * - Refresh email list
 * 
 * API Endpoints Used:
 * - GET /api/gmail/messages - List emails
 * - POST /api/gmail/messages - Send email
 * 
 * @returns {JSX.Element} Gmail panel component
 */
function GmailPanel() {
  const { toast } = useToast();
  
  /**
   * Compose mode state
   * When true, shows compose form; when false, shows email list
   */
  const [composing, setComposing] = useState(false);
  
  /**
   * Email composition form state
   */
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  /**
   * Query: Fetch list of emails
   */
  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/gmail/messages'],
    queryFn: () => fetch('/api/gmail/messages').then(res => res.json()),
  });

  /**
   * Mutation: Send email
   * Posts new email to Gmail API
   */
  const sendMutation = useMutation({
    mutationFn: (data: { to: string; subject: string; body: string }) =>
      fetch('/api/gmail/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Email sent successfully!' });
      setComposing(false);
      // Reset form
      setTo('');
      setSubject('');
      setBody('');
      refetch();
    },
    onError: () => {
      toast({ title: 'Failed to send email', variant: 'destructive' });
    },
  });

  // Compose Form View
  if (composing) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-gmail-back" variant="ghost" onClick={() => setComposing(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-gmail-to"
          placeholder="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Input
          data-testid="input-gmail-subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          data-testid="textarea-gmail-body"
          placeholder="Message body..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
        />
        <Button
          data-testid="button-gmail-send"
          onClick={() => sendMutation.mutate({ to, subject, body })}
          disabled={!to || !subject || !body || sendMutation.isPending}
        >
          <Send className="h-4 w-4 mr-2" /> Send
        </Button>
      </div>
    );
  }

  // Email List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-gmail-compose" onClick={() => setComposing(true)}>
          <Plus className="h-4 w-4 mr-2" /> Compose
        </Button>
        <Button data-testid="button-gmail-refresh" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Email List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground">Loading emails...</p>
          ) : emails.length === 0 ? (
            <p className="text-muted-foreground">No emails found</p>
          ) : (
            emails.map((email: any) => (
              <Card key={email.id} data-testid={`card-gmail-email-${email.id}`}>
                <CardContent className="p-3">
                  <div className="font-medium truncate">{email.subject || '(no subject)'}</div>
                  <div className="text-sm text-muted-foreground truncate">{email.from}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{email.snippet}</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// GOOGLE CALENDAR PANEL COMPONENT
// ============================================================================

/**
 * CalendarPanel - Google Calendar Event Manager
 * 
 * Displays calendar events and allows creating new events.
 * 
 * Features:
 * - List upcoming events
 * - View event title and date/time
 * - Create new events with start/end times
 * - Refresh event list
 * 
 * API Endpoints Used:
 * - GET /api/calendar/events - List events
 * - POST /api/calendar/events - Create event
 * 
 * @returns {JSX.Element} Calendar panel component
 */
function CalendarPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  /**
   * Create mode state
   */
  const [creating, setCreating] = useState(false);
  
  /**
   * Event creation form state
   */
  const [summary, setSummary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  /**
   * Query: Fetch list of calendar events
   */
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/calendar/events'],
    queryFn: () => fetch('/api/calendar/events').then(res => res.json()),
  });

  /**
   * Mutation: Create calendar event
   */
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Event created!' });
      setCreating(false);
      // Reset form
      setSummary('');
      setStartDate('');
      setEndDate('');
      refetch();
    },
  });

  // Create Event Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-calendar-back" variant="ghost" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-calendar-summary"
          placeholder="Event title"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <Input
          data-testid="input-calendar-start"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          data-testid="input-calendar-end"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button
          data-testid="button-calendar-create"
          onClick={() => createMutation.mutate({
            summary,
            start: { dateTime: new Date(startDate).toISOString() },
            end: { dateTime: new Date(endDate).toISOString() },
          })}
          disabled={!summary || !startDate || !endDate}
        >
          Create Event
        </Button>
      </div>
    );
  }

  // Event List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-calendar-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Event
        </Button>
        <Button data-testid="button-calendar-refresh" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Event List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-muted-foreground">No upcoming events</p>
          ) : (
            events.map((event: any) => (
              <Card key={event.id} data-testid={`card-calendar-event-${event.id}`}>
                <CardContent className="p-3">
                  <div className="font-medium">{event.summary}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(event.start?.dateTime || event.start?.date).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// GOOGLE DOCS PANEL COMPONENT
// ============================================================================

/**
 * DocsPanel - Google Docs Manager
 * 
 * Lists Google Docs and allows creating new documents.
 * 
 * Features:
 * - List recent Google Docs
 * - View document name and modification date
 * - Open documents in Google Docs web interface
 * - Create new documents
 * 
 * API Endpoints Used:
 * - GET /api/docs - List documents
 * - POST /api/docs - Create document
 * 
 * @returns {JSX.Element} Docs panel component
 */
function DocsPanel() {
  const { toast } = useToast();
  
  /**
   * Create mode and form state
   */
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  /**
   * Query: Fetch list of Google Docs
   */
  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/docs'],
    queryFn: () => fetch('/api/docs').then(res => res.json()),
  });

  /**
   * Mutation: Create new document
   */
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Document created!' });
      setCreating(false);
      setTitle('');
      refetch();
    },
  });

  // Create Document Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-docs-back" variant="ghost" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-docs-title"
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          data-testid="button-docs-create"
          onClick={() => createMutation.mutate(title)}
          disabled={!title}
        >
          Create Document
        </Button>
      </div>
    );
  }

  // Document List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-docs-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Document
        </Button>
        <Button data-testid="button-docs-refresh" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Document List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground">Loading documents...</p>
          ) : docs.length === 0 ? (
            <p className="text-muted-foreground">No documents found</p>
          ) : (
            docs.map((doc: any) => (
              <Card key={doc.id} data-testid={`card-docs-doc-${doc.id}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(doc.modifiedTime).toLocaleDateString()}
                    </div>
                  </div>
                  {/* Open in Docs button */}
                  {doc.webViewLink && (
                    <a href={doc.webViewLink} target="_blank" rel="noopener noreferrer">
                      <Button data-testid={`button-open-doc-${doc.id}`} variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// GOOGLE SHEETS PANEL COMPONENT
// ============================================================================

/**
 * SheetsPanel - Google Sheets Manager
 * 
 * Lists Google Sheets and allows creating new spreadsheets.
 * 
 * Features:
 * - List recent Google Sheets
 * - View spreadsheet name and modification date
 * - Open spreadsheets in Google Sheets web interface
 * - Create new spreadsheets
 * 
 * API Endpoints Used:
 * - GET /api/sheets - List spreadsheets
 * - POST /api/sheets - Create spreadsheet
 * 
 * @returns {JSX.Element} Sheets panel component
 */
function SheetsPanel() {
  const { toast } = useToast();
  
  /**
   * Create mode and form state
   */
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  /**
   * Query: Fetch list of Google Sheets
   */
  const { data: sheets = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/sheets'],
    queryFn: () => fetch('/api/sheets').then(res => res.json()),
  });

  /**
   * Mutation: Create new spreadsheet
   */
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Spreadsheet created!' });
      setCreating(false);
      setTitle('');
      refetch();
    },
  });

  // Create Spreadsheet Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-sheets-back" variant="ghost" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-sheets-title"
          placeholder="Spreadsheet title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          data-testid="button-sheets-create"
          onClick={() => createMutation.mutate(title)}
          disabled={!title}
        >
          Create Spreadsheet
        </Button>
      </div>
    );
  }

  // Spreadsheet List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-sheets-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Spreadsheet
        </Button>
        <Button data-testid="button-sheets-refresh" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Spreadsheet List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground">Loading spreadsheets...</p>
          ) : sheets.length === 0 ? (
            <p className="text-muted-foreground">No spreadsheets found</p>
          ) : (
            sheets.map((sheet: any) => (
              <Card key={sheet.id} data-testid={`card-sheets-sheet-${sheet.id}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{sheet.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(sheet.modifiedTime).toLocaleDateString()}
                    </div>
                  </div>
                  {/* Open in Sheets button */}
                  {sheet.webViewLink && (
                    <a href={sheet.webViewLink} target="_blank" rel="noopener noreferrer">
                      <Button data-testid={`button-open-sheet-${sheet.id}`} variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// GOOGLE TASKS PANEL COMPONENT
// ============================================================================

/**
 * TasksPanel - Google Tasks Manager
 * 
 * Manages Google Tasks with task list support.
 * 
 * Features:
 * - List tasks from default task list
 * - View task title and completion status
 * - Mark tasks as completed
 * - Create new tasks
 * - Refresh task list
 * 
 * API Endpoints Used:
 * - GET /api/tasks/lists - List task lists
 * - GET /api/tasks/lists/:listId/tasks - List tasks
 * - POST /api/tasks/lists/:listId/tasks - Create task
 * - POST /api/tasks/lists/:listId/tasks/:taskId/complete - Complete task
 * 
 * @returns {JSX.Element} Tasks panel component
 */
function TasksPanel() {
  const { toast } = useToast();
  
  /**
   * Create mode and form state
   */
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  
  /**
   * Selected task list (defaults to @default)
   */
  const [selectedList, setSelectedList] = useState<string>('@default');

  /**
   * Query: Fetch list of task lists
   */
  const { data: taskLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['/api/tasks/lists'],
    queryFn: () => fetch('/api/tasks/lists').then(res => res.json()),
  });

  /**
   * Query: Fetch tasks from selected list
   */
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['/api/tasks/lists', selectedList, 'tasks'],
    queryFn: () => fetch(`/api/tasks/lists/${selectedList}/tasks`).then(res => res.json()),
    enabled: !!selectedList,
  });

  /**
   * Mutation: Create new task
   */
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch(`/api/tasks/lists/${selectedList}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Task created!' });
      setCreating(false);
      setTitle('');
      refetch();
    },
  });

  /**
   * Mutation: Mark task as completed
   */
  const completeMutation = useMutation({
    mutationFn: (taskId: string) =>
      fetch(`/api/tasks/lists/${selectedList}/tasks/${taskId}/complete`, {
        method: 'POST',
      }).then(res => res.json()),
    onSuccess: () => refetch(),
  });

  // Create Task Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-tasks-back" variant="ghost" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-tasks-title"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          data-testid="button-tasks-create"
          onClick={() => createMutation.mutate(title)}
          disabled={!title}
        >
          Create Task
        </Button>
      </div>
    );
  }

  // Task List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-tasks-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Task
        </Button>
        <Button data-testid="button-tasks-refresh" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Task List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {tasksLoading ? (
            <p className="text-muted-foreground">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground">No tasks found</p>
          ) : (
            tasks.map((task: any) => (
              <Card key={task.id} data-testid={`card-tasks-task-${task.id}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  {/* Complete Task Button */}
                  <Button
                    data-testid={`button-complete-task-${task.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => completeMutation.mutate(task.id)}
                    disabled={task.status === 'completed'}
                  >
                    <CheckSquare className={`h-4 w-4 ${task.status === 'completed' ? 'text-green-500' : ''}`} />
                  </Button>
                  {/* Task Title (strikethrough if completed) */}
                  <div className={task.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                    {task.title}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/**
 * GoogleServicesPage - Google Workspace Dashboard
 * 
 * The main page component that provides a tabbed interface for accessing
 * all Google Workspace services. Each tab loads a specific service panel.
 * 
 * Tab Structure:
 * - Drive: File browser and search
 * - Gmail: Email client
 * - Calendar: Event manager
 * - Docs: Document manager
 * - Sheets: Spreadsheet manager
 * - Tasks: Task manager
 * 
 * @returns {JSX.Element} Google Services dashboard page
 */
export default function GoogleServicesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 
       * Page Header
       * Back navigation and page title
       */}
      <header className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back to Chat button */}
            <Link href="/">
              <Button data-testid="button-back-home" variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Chat
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Google Workspace</h1>
          </div>
        </div>
      </header>
      
      {/* 
       * Main Content Area
       * Contains tabbed interface for all services
       */}
      <main className="container mx-auto p-4">
        <Tabs defaultValue="drive" className="w-full">
          {/* 
           * Tab Navigation
           * 6-column grid with icon + label for each service
           */}
          <TabsList className="grid w-full grid-cols-6 mb-4">
            <TabsTrigger data-testid="tab-drive" value="drive" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Drive
            </TabsTrigger>
            <TabsTrigger data-testid="tab-gmail" value="gmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Gmail
            </TabsTrigger>
            <TabsTrigger data-testid="tab-calendar" value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Calendar
            </TabsTrigger>
            <TabsTrigger data-testid="tab-docs" value="docs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Docs
            </TabsTrigger>
            <TabsTrigger data-testid="tab-sheets" value="sheets" className="flex items-center gap-2">
              <Table2 className="h-4 w-4" /> Sheets
            </TabsTrigger>
            <TabsTrigger data-testid="tab-tasks" value="tasks" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Tasks
            </TabsTrigger>
          </TabsList>

          {/* 
           * Tab Content Panels
           * Each panel is wrapped in a Card for consistent styling
           */}
          <Card>
            <CardContent className="p-6">
              
              {/* Google Drive Tab */}
              <TabsContent value="drive">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Google Drive</CardTitle>
                  <CardDescription>Browse and manage your files</CardDescription>
                </CardHeader>
                <DrivePanel />
              </TabsContent>

              {/* Gmail Tab */}
              <TabsContent value="gmail">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Gmail</CardTitle>
                  <CardDescription>Read and send emails</CardDescription>
                </CardHeader>
                <GmailPanel />
              </TabsContent>

              {/* Google Calendar Tab */}
              <TabsContent value="calendar">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Google Calendar</CardTitle>
                  <CardDescription>View and manage events</CardDescription>
                </CardHeader>
                <CalendarPanel />
              </TabsContent>

              {/* Google Docs Tab */}
              <TabsContent value="docs">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Google Docs</CardTitle>
                  <CardDescription>Create and edit documents</CardDescription>
                </CardHeader>
                <DocsPanel />
              </TabsContent>

              {/* Google Sheets Tab */}
              <TabsContent value="sheets">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Google Sheets</CardTitle>
                  <CardDescription>Create and edit spreadsheets</CardDescription>
                </CardHeader>
                <SheetsPanel />
              </TabsContent>

              {/* Google Tasks Tab */}
              <TabsContent value="tasks">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Google Tasks</CardTitle>
                  <CardDescription>Manage your tasks and to-do lists</CardDescription>
                </CardHeader>
                <TasksPanel />
              </TabsContent>
              
            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  );
}
