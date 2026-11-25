import s from "./book.module.css";

export default function Book() {
  return (
    <main className={s.page}>
      <h1 className={s.title}>Book a room</h1>
      <section data-testid="form" className={s.panel}>
        <label htmlFor="name">Name</label>
        <input id="name" data-testid="name" className={s.field} />
        <button type="button" data-testid="book" className={s.button}>Book</button>
      </section>
    </main>
  );
}
