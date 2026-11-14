function notFound() {
  const main = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = 'Página no encontrada';
  const text = document.createElement('p');
  text.textContent = 'La dirección que buscas no existe.';
  main.append(heading, text);
  return main;
}

export { notFound as notFoundPage };
