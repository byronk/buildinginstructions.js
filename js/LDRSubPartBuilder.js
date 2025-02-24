'use strict';

LDR.ICON_SIZE = 200;

/*
  The LDRSubPartBulder is used for displaying a part and all of its sub parts, 
  primitives, and comment lines.
*/
LDR.SubPartBuilder = function(baseMC, table, redPoints, loader, partType, colorID, position, rotation, scene, subjectSize, onIconClick, from) {
    let self = this;
    this.baseMC = baseMC;
    this.table = table;
    this.redPoints = redPoints;
    this.loader = loader;
    this.c = colorID;
    this.p = position;
    this.r = rotation;
    this.scene = scene;
    this.partType = partType;
    this.linesBuilt = false;
    this.onIconClick = onIconClick;
    this.from = from;

    this.camera = new THREE.OrthographicCamera(-subjectSize, subjectSize, subjectSize, -subjectSize, 0.1, 1000000);
    this.camera.position.set(10*subjectSize, 7*subjectSize, 10*subjectSize);
    this.camera.lookAt(new THREE.Vector3());
    this.camera.updateProjectionMatrix();   
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(LDR.ICON_SIZE, LDR.ICON_SIZE);    
    this.render = function() {
        self.renderer.render(self.scene, self.camera);
    }

    let p0 = new THREE.Vector3();
    let m0 = new THREE.Matrix3(); m0.set(1, 0, 0, 0, 1, 0, 0, 0, 1);

    // Add self to table:
    let tr = LDR.makeEle(table, 'tr');
    LDR.makeEle(tr, 'td', 'line_type').innerHTML = partType.ID;
    LDR.makeEle(tr, 'td', 'line_desc').innerHTML = LDR.writePrettyPointsPR(p0, m0);
    LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (this.partType.certifiedBFC ? '4' : '6') + ";";;
    let CCW = this.partType.CCW;
    LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (CCW ? 'A' : 'B') + ";";
    LDR.makeEle(tr, 'td', 'line_color').innerHTML = colorID;
    this.imageHolder = LDR.makeEle(tr, 'td', 'line_image');

    // Add icon for self:
    this.canvas = LDR.buildThumbnail(this.imageHolder);
    this.canvas.addEventListener('click', function(){
	self.setFileLineVisibility(false);
	self.baseMC.setVisible(true);
	self.redPoints.visible = false;
	self.onIconClick();
    }, false);
}

LDR.writePrettyPointColors = ['#FFA500', '#00CC00', '#4444FF', '#A500FF'];

LDR.writePrettyPoints = function(ele, pts) {
    let ul = LDR.makeEle(ele, 'ul', 'pretty_points');
    for(let i = 0; i < pts.length; i++) {
	let li = LDR.makeEle(ul, 'li');
	li.style.color = LDR.writePrettyPointColors[i];

	let span = LDR.makeEle(li, 'span', 'pretty_points');
	let x = pts[i].x;
	let y = pts[i].y;
	let z = pts[i].z;
	span.innerHTML = x + ' ' + y + ' ' + z;
    }
}

LDR.writePrettyPointsPR = function(p, r) {
    let ret = p.x + ' ' + p.y + ' ' + p.z;
    r.elements.forEach(e => ret += ' ' + e);
    return ret;
}

LDR.makeEle = function(parent, type, cls) {
    let ret = document.createElement(type);
    parent.appendChild(ret);
    if(cls) {
	ret.setAttribute('class', cls);
    }
    return ret;
}

LDR.buildThumbnail = function(ele) {
    // Add thumbnail:
    let iconSceneHolder = document.createElement('span');
    iconSceneHolder.setAttribute('class', 'iconScene');
    ele.appendChild(iconSceneHolder);

    let canvas = document.createElement('canvas');
    let w = LDR.ICON_SIZE, h = LDR.ICON_SIZE;
    canvas.width = w*window.devicePixelRatio;
    canvas.height = h*window.devicePixelRatio;
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
    iconSceneHolder.appendChild(canvas);
    return canvas;
}

THREE.LDRStep.prototype.removePrimitivesAndSubParts = () => {}; // Ensure primitives are not deleted.

LDR.SubPartBuilder.prototype.setFileLineVisibility = function(v) {
    if(!this.linesBuilt) {
	return;
    }
    let fileLines = this.partType.steps[0].fileLines;
    for(let i = 0; i < fileLines.length; i++) {
	let line = fileLines[i];
	if(line.line0) {
	    continue;
	}
	line.mc.setVisible(v);
	if(line.markers) {
	    line.markers.visible = v;
	}
    }
}

LDR.SubPartBuilder.prototype.buildIcons = function(baseObject, linkPrefix) {
    const self = this;
    // Handle all lines:
    let transformColor = function(subColorID) {
	if(subColorID === 16) {
	    return self.c; // Main color
	}
	if(subColorID === 24) {
	    if(self.c === 16) {
		return 24;
	    }
	    else {
		return -self.c-1; // Edge color
	    }
	}
	return subColorID;
    }
    let transformPoint = function(p) {
	let ret = new THREE.Vector3(p.x, p.y, p.z);
	ret.applyMatrix3(self.r);
	ret.add(self.p);
	return ret;
    }

    let fileLines = this.partType.steps[0].fileLines;
    for(let i = 0; i < fileLines.length; i++) {
	let line = fileLines[i];
	let p1, p2, p3, p4;
	
	let tr = LDR.makeEle(this.table, 'tr');
	if(line.line0) { // Comment line - just display.
	    LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Comment';
	    let content = LDR.makeEle(tr, 'td', 'line_desc');
	    content.innerHTML = line.txt;
	    content.setAttribute('colspan', '5');
	}
	else {
	    line.mc = new LDR.MeshCollector(baseObject, baseObject);
	    let c = transformColor(line.line1 ? line.desc.colorID : line.c);

	    let color = LDR.Colors[c];
	    let shownColor = color.direct ? color.direct : colorID;
	    let step = new THREE.LDRStep(); // Not used by line1.

	    if(line.line1) {
                let pt = this.loader.getPartType(line.desc.ID);
		if(!pt) {
		    throw {
			name: "UnloadedPartTypeException",
			level: "Severe",
			message: "Unloaded part type: " + line.desc.ID,
			htmlMessage: "Unloaded part type: " + line.desc.ID,
			toString: function(){return "Unloaded part type: " + line.desc.ID;} 
		    };
		}

		let typeEle = LDR.makeEle(tr, 'td', 'line_type');
		let a = document.createElement('a');
		let url = linkPrefix;
		if(pt.inlined && !isNaN(pt.inlined)) {
		    url += "part.php?user_id=" + pt.inlined + "&id=";
		}
		else if(pt.inlined === undefined) {
		    url += "part.php?from=" + self.from + "&id=";
		}
		a.setAttribute('href', url + pt.ID);
		a.innerHTML = line.desc.ID;
		typeEle.appendChild(a);

		LDR.makeEle(tr, 'td', 'line_desc').innerHTML = LDR.writePrettyPointsPR(line.desc.position, line.desc.rotation);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.desc.cull ? '4' : '6') + ";";
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (!line.desc.invertCCW ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.desc.colorID;

                // Hack in a new part type for the sub model:
                let identityRotation = new THREE.Matrix3();
                identityRotation.set(1, 0, 0,
                                     0, 1, 0,
                                     0, 0, 1);
                let pd = new THREE.LDRPartDescription(40, new THREE.Vector3(), identityRotation, pt.ID, true, false);
                let g = new LDR.LDRGeometry();
                g.fromPartDescription(this.loader, line.desc);

                step.addSubModel(pd);
                pt = new THREE.LDRPartType();
                pt.ID = 'HIGHLIGHT_PART_' + i;
                pt.addStep(step);
                pt.geometry = g;
		pt.generateThreePart(this.loader, 40, this.p, this.r, true, false, line.mc, pd);
	    }
	    else if(line.line2) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Line';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);		
		step.addLine(c, p1, p2);
	    }
	    else if(line.line3) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Triangle';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";;
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (line.ccw ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		step.addTrianglePoints(c, p1, p2, p3);
	    }
	    else if(line.line4) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Quad';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3, line.p4]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";;
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (line.ccw ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		p4 = transformPoint(line.p4);
		step.addQuadPoints(c, p1, p2, p3, p4);
	    }
	    else if(line.line5) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Optional';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3, line.p4]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		p4 = transformPoint(line.p4);
		step.addConditionalLine(c, p1, p2, p3, p4);
	    }

	    if(!line.line1) {
                let pt = new THREE.LDRPartType();
                pt.ID = 'Shadow part for step';
		pt.addStep(step);
		pt.ensureGeometry(this.loader);
		pt.generateThreePart(this.loader, c, new THREE.Vector3(), new THREE.Matrix3(), line.cull, line.ccw, line.mc);
	    }

	    line.imageHolder = LDR.makeEle(tr, 'td', 'line_image');
	}

	if(p1) {
	    // Add line points to cloud:
	    let pts = [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z];
	    let c1 = new THREE.Color(LDR.writePrettyPointColors[0]);
	    let c2 = new THREE.Color(LDR.writePrettyPointColors[1]);
	    let colors = [c1.r, c1.g, c1.b, c2.r, c2.g, c2.b];

	    if(p3) {
		pts.push(p3.x, p3.y, p3.z);
		let c3 = new THREE.Color(LDR.writePrettyPointColors[2]);
		colors.push(c3.r, c3.g, c3.b);
	    }
	    if(p4) {
		pts.push(p4.x, p4.y, p4.z);
		let c4 = new THREE.Color(LDR.writePrettyPointColors[3]);
		colors.push(c4.r, c4.g, c4.b);
	    }

	    let vertexAttribute = new THREE.Float32BufferAttribute(pts, 3);	
	    let colorAttribute = new THREE.Float32BufferAttribute(colors, 3);

	    let pointGeometry = new THREE.BufferGeometry();
	    pointGeometry.addAttribute('color', colorAttribute);
	    pointGeometry.addAttribute('position', vertexAttribute);

	    let pointMaterial = new THREE.PointsMaterial({size: 3.5, vertexColors: THREE.VertexColors});

            line.markers = new THREE.Points(pointGeometry, pointMaterial);
	    line.markers.visible = false;
	}
    }

    // Icons for lines:
    for(let i = 0; i < fileLines.length; i++) {
	const line = fileLines[i];
	if(line.line0) {
	    continue;
	}

	line.canvas = LDR.buildThumbnail(line.imageHolder);
	line.canvas.line = line;
	line.canvas.addEventListener('click', function() {
            // Show only this file line and its markers:
	    self.baseMC.setVisible(false);
	    self.setFileLineVisibility(false);
	    this.line.mc.setVisible(true);
	    self.redPoints.visible = true;
	    if(this.line.markers) {
		this.line.markers.visible = true;
	    }
	    self.onIconClick();
	}, false);

	if(line.markers) {
	    baseObject.add(line.markers);
	    line.markers.updateMatrix();
	}
    }

    this.linesBuilt = true;
} 

LDR.SubPartBuilder.prototype.drawAllIcons = function() {
    // Base icon:
    this.setFileLineVisibility(false);
    this.redPoints.visible = false;

    this.baseMC.setVisible(true);
    this.baseMC.overwriteColor(this.c);
    this.baseMC.draw(false);
    this.render();
    let context = this.canvas.getContext('2d');
    context.drawImage(this.renderer.domElement, 0, 0);

    if(!this.linesBuilt) {
	return;
    }

    // Icons for lines:
    this.baseMC.setVisible(false);
    this.redPoints.visible = true;
    let fileLines = this.partType.steps[0].fileLines;
    for(let i = 0; i < fileLines.length; i++) {
	let line = fileLines[i];
	if(line.line0) {
	    continue;
	}

	line.mc.setVisible(true);
	line.mc.overwriteColor(this.c);
	line.mc.draw(false);
	if(line.markers) {
	    line.markers.visible = true;
	}

	this.render();
	context = line.canvas.getContext('2d');
	context.drawImage(this.renderer.domElement, 0, 0);

	line.mc.setVisible(false);
	if(line.markers) {
	    line.markers.visible = false;
	}
    }
    this.redPoints.visible = false;
    this.baseMC.setVisible(true);
}
