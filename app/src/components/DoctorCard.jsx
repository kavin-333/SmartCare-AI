function DoctorCard({ doctor, onBook }) {
  return (
    <article className="doctor-card">
      <div className="doctor-card-top">
        <div className="doctor-avatar">
          {doctor.initials ||
            doctor.name
              .replace("Dr. ", "")
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
        </div>

        <span className="availability">
          <span className="status-dot"></span>
          Available
        </span>
      </div>

      <div className="doctor-info">
        <h3>{doctor.name}</h3>

        <p className="doctor-specialty">
          {doctor.specialization}
        </p>

        <div className="doctor-rating">
          <span>★</span> {doctor.rating ?? "N/A"}

          <span className="rating-count">
            ({doctor.reviews ?? 0} reviews)
          </span>
        </div>
      </div>

      <div className="doctor-details">
        <div>
          <span className="detail-label">Experience</span>
          <strong>
            {doctor.experience ?? "N/A"} 
            {doctor.experience != null ? " years" : ""}
          </strong>
        </div>

        <div>
          <span className="detail-label">Consultation</span>
          <strong>₹{doctor.fee}</strong>
        </div>
      </div>

      <div className="doctor-card-footer">
        <span className="hospital-name">
          {doctor.hospital ?? "SmartCare Clinic"}
        </span>

        <button
          className="book-button"
          onClick={() => onBook(doctor)}
        >
          Book Appointment
          <span>→</span>
        </button>
      </div>
    </article>
  );
}

export default DoctorCard;