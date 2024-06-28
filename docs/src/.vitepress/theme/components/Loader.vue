<template>
  <div class="loader-container">
    <div class="loader-wrapper">
      <div class="loader">
        <div class="loader-ball" />
        <div class="loader-ball" />
        <div class="loader-ball" />
        <div class="loader-shadow" />
        <div class="loader-shadow" />
        <div class="loader-shadow" />
      </div>
      <div class="loader-text">
        Compiling SQL...
      </div>
    </div>
  </div>
</template>

<style>
.loader-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
}

.loader-wrapper {
  position: relative;
  margin-left: 30px;
}

.loader {
  width: 100px;
  height: 40px;
  position: absolute;
  right: 100%;
  margin-right: 12px;
  z-index: 1;
}

.loader-text {
  padding-top: 4px;
}

.loader-ball {
  width: 10px;
  height: 10px;
  position: absolute;
  border-radius: 50%;
  background-color: var(--vp-c-brand-1);
  left: 15%;
  transform-origin: 50%;
  animation: loader-animation .5s alternate infinite ease;
}

@keyframes loader-animation {
  0% {
    top: 30px;
    height: 3px;
    border-radius: 25px 25px 13px 13px;
    transform: scaleX(1.7);
  }

  40% {
    height: 10px;
    border-radius: 50%;
    transform: scaleX(1);
  }

  100% {
    top: 0%;
  }
}

.loader-ball:nth-child(2) {
  left: 45%;
  animation-delay: .2s;
}

.loader-ball:nth-child(3) {
  left: auto;
  right: 15%;
  animation-delay: .3s;
}

.loader-shadow {
  width: 10px;
  height: 2px;
  border-radius: 50%;
  background-color: rgba(0,0,0,0.9);
  position: absolute;
  top: 31px;
  transform-origin: 50%;
  z-index: -1;
  left: 15%;
  filter: blur(1px);
  animation: loader-shadow-animation .5s alternate infinite ease;
}

@keyframes loader-shadow-animation {
  0% {
    transform: scaleX(1.5);
  }

  40% {
    transform: scaleX(1);
    opacity: .7;
  }

  100% {
    transform: scaleX(.2);
    opacity: .4;
  }
}

.loader-shadow:nth-child(4) {
  left: 45%;
  animation-delay: .2s
}

.loader-shadow:nth-child(5) {
  left: auto;
  right: 15%;
  animation-delay: .3s;
}
</style>
