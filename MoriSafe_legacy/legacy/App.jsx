{/*remembers information that changes while someone uses your website*/}
import { useState } from 'react'
import './App.css'



function App() {

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState('ALL')
  const [activeTab, setActiveTab] = useState('alerts')
  const [incidentType, setIncidentType] = useState('')
  const [otherIncident, setOtherIncident] = useState('')
  // Stores the user's description of the incident
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('')
  const [location, setLocation] = useState('')
  const [coordinates, setCoordinates] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [observedTime, setObservedTime] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [incidentImage, setIncidentImage] = useState(null)
  const [imageInputKey, setImageInputKey] = useState(0)

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        setCoordinates({ latitude, longitude })
        setLocationError('')
      },
      () => {
        setLocationError('Unable to access your location. Please enter it manually.')
      }
    )
  }  

    const handleImageChange = (event) => {
    const file = event.target.files[0]

    if (!file) return

    setIncidentImage(file)

    const reader = new FileReader()

    reader.onloadend = () => {
      setImagePreview(reader.result)
    }

    reader.readAsDataURL(file)
  }

const handleSubmitReport = () => {

  // Check required fields
  if (
    !incidentType ||
    (incidentType === 'Other' && !otherIncident.trim()) ||
    !description.trim() ||
    !severity ||
    !location.trim() ||
    !observedTime ||
    !incidentImage
  ) {
    alert('Please complete all fields before submitting.')
    return
  }

  // Prevent future observation times
  if (new Date(observedTime) > new Date()) {
    alert('Observation time cannot be in the future.')
    return
  }

// Create the new incident
const newIncident = {
  title: incidentType === 'Other'
    ? otherIncident.trim()
    : incidentType,

  location: location.trim(),
  time: 'Just now',
  severity: severity
}

// Add the new incident to the beginning of the list
setIncidents(previousIncidents => [
  newIncident,
  ...previousIncidents
])

alert('Report submitted successfully!')

  // Reset all form fields
  setIncidentType('')
  setOtherIncident('')
  setDescription('')
  setSeverity('')
  setLocation('')
  setCoordinates(null)
  setLocationError('')
  setObservedTime('')
  setIncidentImage(null)
  setImagePreview('')

  // Clear the file input
  setImageInputKey(previous => previous + 1)
}

  // 2. INCIDENT DATA — Our temporary database

  // Each object represents one reported incident
const [incidents, setIncidents] = useState([
  {
    title: 'Flooding',
    location: 'Port Louis',
    time: '10 min ago',
    severity: 'CRITICAL'
  },
  {
    title: 'Road obstruction',
    location: 'Quatre Bornes',
    time: '25 min ago',
    severity: 'MEDIUM'
  },
  {
    title: 'Water disruption',
    location: 'Curepipe',
    time: '1 hr ago',
    severity: 'LOW'
  },
  {
    title: 'Major fire',
    location: 'Rose Hill',
    time: '5 min ago',
    severity: 'HIGH'
  }
])

  // ==========================================
  // 3. FILTER LOGIC — Search and severity
  // ==========================================

  // .filter() checks every incident and keeps
  // only those matching BOTH conditions.
  const filteredIncidents = incidents.filter((incident) => {

    // Check whether the search matches the title
    // or location. toLowerCase() ignores capitalisation.
    const matchesSearch =
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.location.toLowerCase().includes(searchTerm.toLowerCase())

    // Check whether the incident matches the selected severity
    const matchesSeverity =
      selectedSeverity === 'ALL' ||
      incident.severity === selectedSeverity

    // An incident must match both conditions to appear
    return matchesSearch && matchesSeverity
  })

  const emergencyContacts = [
  { name: 'Police Emergency Line', number: '999' },
  { name: 'Police Anonymous', number: '112' },
  { name: 'SAMU Public Ambulance', number: '144' },
  { name: 'Fire and Rescue Services', number: '115' },
  { name: 'Police Information Room', number: '2080034' },
  { name: 'Coast Guard', number: '2122747' },
  { name: 'Weather / Cyclone Information', number: '171' },
  { name: 'Crime Stoppers', number: '148' }
]

  // ==========================================
  // 4. INTERFACE — What appears on the screen
  // ==========================================

  return (
    <div className="app">
      <div className="alerts-screen">

        {/* ALERTS SECTION */}
        {activeTab === 'alerts' && (
          <>

            {/* Main heading */}
            <h1>ALERTS</h1>
            <p>Mauritius Monitoring Network</p>

            {/* Incident summary */}
            <div className="incident-summary">

              <div>
                <h2>04</h2>
                <span>Active incidents</span>
              </div>

              {/* Overview of incident severity */}
              <div className="severity">
                <span className="low">01 LOW</span>
                <span className="medium">01 MEDIUM</span>
                <span className="high">01 HIGH</span>
                <span className="critical">01 CRITICAL</span>
              </div>

            </div>

            {/* Recent incident reports */}
            <div className="incident-list">

              <h3>RECENT INCIDENTS</h3>

              {/* Search bar and severity filter */}
              <div className="incident-controls">

                {/* Search by incident title or location */}
                <input
                  type="text"
                  placeholder="Search incidents or locations..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />

                {/* Filter incidents by severity */}
                <select
                  value={selectedSeverity}
                  onChange={(event) => setSelectedSeverity(event.target.value)}
                >
                  <option value="ALL">All severity</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>

              </div>

              {/* Generate an incident card for each matching incident */}
              {filteredIncidents.map((incident, index) => (

                <div className="incident-card" key={index}>

                  <div>
                    <h4>{incident.title}</h4>
                    <p>{incident.location} · {incident.time}</p>
                  </div>

                  {/* Apply the matching severity CSS class */}
                  <span className={incident.severity.toLowerCase()}>
                    {incident.severity}
                  </span>

                </div>

              ))}

              {/* Display a message if no incidents match */}
              {filteredIncidents.length === 0 && (
                <p>No incidents found.</p>
              )}

            </div>

          </>
        )}



{/* REPORT SECTION */}
{activeTab === 'report' && (
  <div className="report-screen">

    <h1>REPORT INCIDENT</h1>
    <p>Help us keep Mauritius informed and safe.</p>

    {/* Incident category */}
    <div className="form-section">
      <h3>WHAT ARE YOU REPORTING?</h3>

      <select
        value={incidentType}
        onChange={(event) => setIncidentType(event.target.value)}
      >
        <option value="">Select an incident</option>
        <option value="Flooding">Flooding</option>
        <option value="Fire">Fire</option>
        <option value="Road obstruction">Road obstruction</option>
        <option value="Water disruption">Water disruption</option>
        <option value="Power outage">Power outage</option>
        <option value="Landslide">Landslide</option>
        <option value="Other">Other</option>
      </select>

      {incidentType === 'Other' && (
        <input
          type="text"
          placeholder="Enter incident type..."
          value={otherIncident}
          onChange={(event) => setOtherIncident(event.target.value)}
        />
      )}
    </div>

    {/* Incident description */}
    <div className="form-section">
      <h3>DESCRIBE THE INCIDENT</h3>

      <textarea
        placeholder="Describe what happened and what problems it is causing..."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows="5"
      />
    </div>

    {/* Incident severity */}
    <div className="form-section">
      <h3>HOW SEVERE IS THE INCIDENT?</h3>

      <select
        value={severity}
        onChange={(event) => setSeverity(event.target.value)}
      >
        <option value="">Select severity</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
    </div>

    {/* Incident location */}
    <div className="form-section">
      <h3>WHERE IS THE INCIDENT?</h3>

      <input
        type="text"
        placeholder="Enter town, village or address..."
        value={location}
        onChange={(event) => setLocation(event.target.value)}
      />

      <button type="button" onClick={getCurrentLocation}>
        Use My Location
      </button>

      {coordinates && (
        <p>
          Latitude: {coordinates.latitude.toFixed(5)}
          <br />
          Longitude: {coordinates.longitude.toFixed(5)}
        </p>
      )}

      {locationError && <p>{locationError}</p>}
    </div>

    {/* Time observed */}
    <div className="form-section">
      <h3>WHEN DID YOU OBSERVE THE INCIDENT?</h3>

      <input
        type="datetime-local"
        value={observedTime}
        onChange={(event) => setObservedTime(event.target.value)}
      />

      <button
        type="button"
        onClick={() => {
          const now = new Date()
          const localTime = new Date(
            now.getTime() - now.getTimezoneOffset() * 60000
          )
            .toISOString()
            .slice(0, 16)

          setObservedTime(localTime)
        }}
      >
        Use Current Date & Time
      </button>

</div>

{/* Incident image */}
<div className="form-section">
  <h3>ADD A PHOTO OF THE INCIDENT</h3>

  <input
    key={imageInputKey}
    type="file"
    accept="image/*"
    onChange={handleImageChange}
  />


  {imagePreview && (
    <div className="image-preview">
      <img src={imagePreview} alt="Incident preview" />

      <button
        type="button"
        onClick={() => {
          setIncidentImage(null)
          setImagePreview('')
        }}
      >
        Remove Picture
      </button>
    </div>
  )}
</div>

  <div className="form-section">
    <button
      type="button"
      onClick={handleSubmitReport}
    >
      SUBMIT REPORT
    </button>
  </div>

  </div>
)}  

{/* CONTACTS SECTION */}
{activeTab === 'contacts' && (
  <div className="contacts-screen">

    <h1>EMERGENCY CONTACTS</h1>
    <p>Important emergency numbers in Mauritius.</p>

    <div className="contact-list">

      {emergencyContacts.map((contact, index) => (
        <div className="contact-card" key={index}>

          <div>
            <h3>{contact.name}</h3>
            <p>{contact.number}</p>
          </div>

          <a href={`tel:${contact.number}`}>
            CALL
          </a>

        </div>
      ))}

    </div>

  </div>
)}

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="bottom-nav">

          <button
            className={activeTab === 'alerts' ? 'nav-button active' : 'nav-button'}
            onClick={() => setActiveTab('alerts')}
          >
            Alerts
          </button>

          <button
            className={activeTab === 'report' ? 'nav-button active' : 'nav-button'}
            onClick={() => setActiveTab('report')}
          >
            Report
          </button>

          <button
            className={activeTab === 'contacts' ? 'nav-button active' : 'nav-button'}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>

        </nav>

      </div>
    </div>
  )
}

export default App