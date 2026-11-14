function forbidden() {
  const main = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = 'Sin permiso';
  const text = document.createElement('p');
  text.textContent = 'Tu rol no tiene acceso a esta página.';
  main.append(heading, text);
  return main;
}

export { forbidden as forbiddenPage };
